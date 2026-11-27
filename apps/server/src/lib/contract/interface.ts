/**
 * A contract's interface (`keeta-contract-interface`, written by the
 * contract SDK and published by the verifier): the borsh schema of its
 * instructions and state accounts, and how state account ids are derived.
 *
 * With it, instruction data and state accounts can be shown decoded, and a
 * state account's 32-byte id matched back to the kind of account it is.
 */
import { createHash } from 'node:crypto';
import * as v from 'valibot';
import { decodeBorshExact, tryDecodeBorshExact, addressesIn, BorshDecodeError, type BorshSchema, type DecodedValue } from './borsh';
import { encodeAddress } from './address';

/**
 * Schema of the interface, checked before anything is decoded with it
 */
const typeNameSchema = v.pipe(v.string(), v.minLength(1));

const typeDefinitionSchema = v.variant('kind', [
	v.object({ kind: v.literal('primitive'), size: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(64)) }),
	v.object({ kind: v.literal('address') }),
	v.object({
		kind: v.literal('struct'),
		fields: v.array(v.union([typeNameSchema, v.object({ name: v.string(), type: typeNameSchema })]))
	}),
	v.object({
		kind: v.literal('enum'),
		tagWidth: v.optional(v.picklist([1, 2, 4])),
		variants: v.array(v.object({
			discriminant: v.pipe(v.number(), v.integer(), v.minValue(0)),
			name: v.string(),
			type: v.optional(v.nullable(typeNameSchema))
		}))
	}),
	v.object({
		kind: v.literal('sequence'),
		elements: typeNameSchema,
		length: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
		lengthWidth: v.optional(v.picklist([1, 2, 4, 8]))
	}),
	v.object({ kind: v.literal('tuple'), elements: v.array(typeNameSchema) })
]);

const seedSchema = v.union([
	v.object({ bytes: v.pipe(v.string(), v.regex(/^([0-9a-fA-F]{2})*$/)) }),
	v.object({ address: v.string() })
]);

const MAX_ACCOUNT_KINDS = 256;
const MAX_SEEDS = 16;

const contractInterfaceSchema = v.object({
	format: v.literal('keeta-contract-interface'),
	name: v.optional(v.string()),
	instruction: v.optional(v.nullable(typeNameSchema)),
	/* Each state account is tried against every kind, so there are only so many */
	accounts: v.optional(v.pipe(v.array(v.object({
		name: v.string(),
		type: typeNameSchema,
		seeds: v.optional(v.pipe(v.array(seedSchema), v.maxLength(MAX_SEEDS)))
	})), v.maxLength(MAX_ACCOUNT_KINDS)), []),
	views: v.optional(v.array(v.object({
		instruction: v.string(),
		returns: typeNameSchema
	})), []),
	types: v.record(v.string(), typeDefinitionSchema)
});

export type ContractInterface = v.InferOutput<typeof contractInterfaceSchema>;
export type ContractAccountKind = ContractInterface['accounts'][number];
export type ContractAccountSeed = NonNullable<ContractAccountKind['seeds']>[number];

/**
 * Parse an interface, or `null` if it is not one this explorer understands
 */
export function parseContractInterface(input: unknown): ContractInterface | null {
	const result = v.safeParse(contractInterfaceSchema, input);
	if (!result.success) {
		return(null);
	}
	return(result.output);
}

function schemaOf(contractInterface: ContractInterface): BorshSchema {
	return(contractInterface.types as BorshSchema);
}

/**
 * Decode
 */
export type DecodeResult = { value: DecodedValue, error?: undefined } | { value?: undefined, error: string };

function decodeAs(contractInterface: ContractInterface, typeName: string, data: Uint8Array): DecodeResult {
	try {
		return({ value: decodeBorshExact(schemaOf(contractInterface), typeName, data) });
	} catch (error) {
		if (error instanceof BorshDecodeError) {
			return({ error: error.message });
		}
		throw(error);
	}
}

/**
 * Decode a call's instruction data, `null` if the interface does not say
 * how instructions are encoded
 */
export function decodeInstruction(contractInterface: ContractInterface, data: Uint8Array): DecodeResult | null {
	if (!contractInterface.instruction) {
		return(null);
	}
	return(decodeAs(contractInterface, contractInterface.instruction, data));
}

/**
 * Decode what a call returned: views (instruction variants that return
 * data) say what type that is
 */
export function decodeReturnData(contractInterface: ContractInterface, instruction: DecodedValue | undefined, data: Uint8Array): DecodeResult | null {
	if (data.length === 0 || !instruction || instruction.kind !== 'enum') {
		return(null);
	}

	const view = contractInterface.views.find(candidate => candidate.instruction === instruction.variant);
	if (!view) {
		return(null);
	}

	return(decodeAs(contractInterface, view.returns, data));
}

/**
 * State account ids
 */

/**
 * The id of a state account: SHA-256 of its seeds, concatenated
 */
export function stateAccountId(seeds: Uint8Array[]): Buffer {
	const hash = createHash('sha256');
	for (const seed of seeds) {
		hash.update(seed);
	}
	return(hash.digest());
}

/** Names of the address seeds of a kind of account, in order */
function addressSeedNames(kind: ContractAccountKind): string[] {
	return((kind.seeds ?? []).flatMap(seed => 'address' in seed ? [seed.address] : []));
}

/**
 * The seeds of an account of `kind`, given an account for each of its
 * address seeds
 */
export function encodeSeeds(kind: ContractAccountKind, addresses: { [seedName: string]: string }, encode: (address: string) => Buffer = encodeAddress): Buffer[] {
	return((kind.seeds ?? []).map(seed => {
		if ('bytes' in seed) {
			return(Buffer.from(seed.bytes, 'hex'));
		}

		const address = addresses[seed.address];
		if (address === undefined) {
			throw(new Error(`No account for seed "${seed.address}"`));
		}
		return(encode(address));
	}));
}

/** Most ids tried for one kind of account with address seeds */
const MAX_CANDIDATE_IDS = 4096;

/** Most ids tried for all the kinds of an interface together */
const MAX_INDEXED_IDS = 16_384;

/**
 * Every assignment of `candidates` to `names`, at most `limit` of them
 */
function assignments(names: string[], candidates: string[], limit: number): { [name: string]: string }[] {
	let result: { [name: string]: string }[] = [{}];
	for (const name of names) {
		const next: { [name: string]: string }[] = [];
		for (const partial of result) {
			for (const candidate of candidates) {
				if (next.length >= limit) {
					break;
				}
				next.push({ ...partial, [name]: candidate });
			}
		}
		result = next;
	}
	return(result);
}

type IdMatch = { kind: ContractAccountKind, seeds: { [seedName: string]: string } };

/**
 * Index the ids of every account the interface's kinds could have:
 * fixed-seed kinds have one, address-seed kinds one per assignment of
 * candidate accounts to their address seeds
 */
function indexStateAccountIds(contractInterface: ContractInterface, candidates: string[]): Map<string, IdMatch> {
	const index = new Map<string, IdMatch>();

	/* Encoding an address parses its key, which costs far more than hashing: do it once per candidate */
	const encoded = new Map<string, Buffer | null>();
	const encode = (address: string): Buffer => {
		let bytes = encoded.get(address);
		if (bytes === undefined) {
			try {
				bytes = encodeAddress(address);
			} catch {
				bytes = null;
			}
			encoded.set(address, bytes);
		}
		if (bytes === null) {
			throw(new Error(`Account ${address} does not fit an address`));
		}
		return(bytes);
	};

	let budget = MAX_INDEXED_IDS;
	for (const kind of contractInterface.accounts) {
		if (!kind.seeds || kind.seeds.length === 0) {
			continue;
		}
		if (budget <= 0) {
			break;
		}

		const names = addressSeedNames(kind);
		const tries = names.length === 0 ? [{}] : assignments(names, candidates, Math.min(MAX_CANDIDATE_IDS, budget));
		budget -= tries.length;
		for (const seeds of tries) {
			let id: string;
			try {
				id = stateAccountId(encodeSeeds(kind, seeds, encode)).toString('hex');
			} catch {
				continue;
			}
			if (!index.has(id)) {
				index.set(id, { kind, seeds });
			}
		}
	}
	return(index);
}

/**
 * Matching state accounts to kinds
 */
export type StateAccountInput = { id: Uint8Array | string, data: Uint8Array | null };

export type StateAccountMatch = {
	/** The kind of account, `null` if nothing matched */
	kind: string | null;
	/**
	 * How it was matched: its id is that of a kind's seeds (with these
	 * accounts for its address seeds), or its data decodes exactly as the
	 * kind's type
	 */
	matchedBy: 'seeds' | 'type' | null;
	seeds?: { [seedName: string]: string };
	/** Other kinds whose type also decodes the data exactly, when matched by type */
	alsoDecodesAs?: string[];
	decoded?: DecodedValue;
	/** Why the data does not decode as the kind its seeds say it is */
	error?: string;
};

function idToHex(id: Uint8Array | string): string {
	return(typeof id === 'string' ? id.toLowerCase() : Buffer.from(id).toString('hex'));
}

function matchOne(contractInterface: ContractInterface, account: StateAccountInput, index: Map<string, IdMatch>): StateAccountMatch {
	const data = account.data;
	const byId = index.get(idToHex(account.id));
	if (byId) {
		const match: StateAccountMatch = { kind: byId.kind.name, matchedBy: 'seeds' };
		if (Object.keys(byId.seeds).length > 0) {
			match.seeds = byId.seeds;
		}
		if (data !== null) {
			const result = decodeAs(contractInterface, byId.kind.type, data);
			if (result.value) {
				match.decoded = result.value;
			} else {
				match.error = result.error;
			}
		}
		return(match);
	}

	if (data === null) {
		return({ kind: null, matchedBy: null });
	}

	/*
	 * Not an id the seeds give (with the candidates tried): try each kind's
	 * type, accepting the first that decodes all the bytes
	 */
	const schema = schemaOf(contractInterface);
	const decodes = contractInterface.accounts.flatMap(kind => {
		const decoded = tryDecodeBorshExact(schema, kind.type, data);
		return(decoded ? [{ kind, decoded }] : []);
	});
	if (decodes.length === 0) {
		return({ kind: null, matchedBy: null });
	}

	const [first, ...others] = decodes;
	const match: StateAccountMatch = { kind: first.kind.name, matchedBy: 'type', decoded: first.decoded };
	if (others.length > 0) {
		match.alsoDecodesAs = others.map(other => other.kind.name);
	}
	return(match);
}

/**
 * Match each state account to a kind of account in the interface.
 *
 * Fixed-seed kinds are matched by computing their id; kinds with address
 * seeds by trying `candidates` (callers, the contract's own accounts, ...)
 * and then the addresses found in the accounts decoded so far; anything
 * else by decoding it as each kind's type. Accounts nothing matches get
 * `kind: null`, to be shown raw.
 */
export function matchStateAccounts(contractInterface: ContractInterface, accounts: StateAccountInput[], candidates: string[]): StateAccountMatch[] {
	const tried = new Set(candidates);
	const firstIndex = indexStateAccountIds(contractInterface, [...tried]);
	let matches = accounts.map(account => matchOne(contractInterface, account, firstIndex));

	/*
	 * Decoded accounts name more accounts (an owner, an admin, ...): try
	 * those for address seeds too, once
	 */
	const found = matches.flatMap(match => match.decoded ? addressesIn(match.decoded) : []).filter(address => !tried.has(address));
	if (found.length > 0 && matches.some(match => match.matchedBy !== 'seeds')) {
		found.forEach(address => tried.add(address));
		const index = indexStateAccountIds(contractInterface, [...tried]);
		matches = matches.map((match, position) => match.matchedBy === 'seeds' ? match : matchOne(contractInterface, accounts[position], index));
	}

	return(matches);
}
