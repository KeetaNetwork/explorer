/**
 * Contracts: their record, code, state and calls, decoded with the
 * interface their verification publishes.
 */
import { createHash } from 'node:crypto';
import { KeetaNetLib } from '@/utils/keetanet';
import type { Network } from '@/lib/network';
import { addressesIn, decodedToPlain, type DecodedValue } from '@/lib/contract/borsh';
import { decodeInstruction, decodeReturnData, matchStateAccounts, type ContractInterface, type StateAccountMatch } from '@/lib/contract/interface';
import {
	blockOperations,
	contractClient,
	isContractCall,
	isContractDeploy,
	isContractOrder,
	stapleContractOutcomes,
	type ContractCallOperation,
	type ContractCallOutcome,
	type ContractClient,
	type ContractEffect
} from '@/lib/contract/operations';
import type { ContractVerificationStatus, ContractVerifier } from '@/lib/contract/verifier';

type GenericAccount = ReturnType<typeof KeetaNetLib.lib.Account.fromPublicKeyString>;
type Block = InstanceType<typeof KeetaNetLib.lib.Block>;
type VoteStaple = InstanceType<typeof KeetaNetLib.lib.Vote.Staple>;

/**
 * Responses
 */
export type ContractRecord = {
	publicKey: string;
	codeHash: string;
	admin: string | null;
	creator: string;
	sequencer: string;
};

export type ContractCode = {
	codeHash: string;
	code: Buffer;
	/** Where the code came from: the ledger, or the block that deployed it (checked against the code hash) */
	source: 'ledger' | 'deploy-block';
};

export type Decoded = {
	/** The value as plain JSON */
	value: unknown;
	/** The value with its types, for display */
	decoded: DecodedValue;
};

export type DecodedOrError = Decoded | { error: string };

export type StateAccountDetails = {
	owner: string;
	id: string;
	version: string;
	/** Hex, `null` for an account the write deleted */
	data: string | null;
	size: number;
	kind: string | null;
	matchedBy: StateAccountMatch['matchedBy'];
	seeds?: { [seedName: string]: string } | undefined;
	alsoDecodesAs?: string[] | undefined;
	value?: unknown;
	decoded?: DecodedValue | undefined;
	error?: string | undefined;
};

export type ContractEffectDetails = {
	kind: 'send';
	from: string;
	to: string;
	token: string;
	amount: string;
	external?: string | undefined;
} | {
	kind: 'setInfo';
	account: string;
	name: string;
	description: string;
	metadata: string;
};

export type ContractCallOutcomeDetails = {
	gasUsed: string;
	returnData: string;
	returned: DecodedOrError | null;
	reads: { owner: string, id: string, version: string, kind: string | null }[];
	writes: StateAccountDetails[];
	effects: ContractEffectDetails[];
	failure: { kind: string, message: string } | null;
};

export type ContractCallDetails = {
	voteStapleHash: string;
	block: string;
	operationIndex: number;
	date: string;
	/** The account whose block made the call */
	caller: string;
	contract: string;
	gasLimit: string;
	/** Instruction data, hex */
	data: string;
	accounts: { owner: string, id: string, writable: boolean, kind: string | null }[];
	/** Tokens the block sent the contract before the call (since any earlier call to it) */
	funds: { token: string, amount: string }[];
	/** Position in the order the contract's sequencer gave, if it ordered it */
	order: number | null;
	instruction: DecodedOrError | null;
	/** `null` if the staple's votes carry no outcome for it */
	outcome: ContractCallOutcomeDetails | null;
};

export type ContractDeployDetails = {
	voteStapleHash: string;
	block: string;
	operationIndex: number;
	date: string;
	creator: string;
	contract: string;
	codeHash: string;
	codeSize: number;
	sequencer: string;
	admin: string | null;
};

const MAX_HISTORY_DEPTH = 50;
const MAX_STATE_LIMIT = 200;
const DEFAULT_STATE_LIMIT = 50;
/** Pages of history searched for the block that deployed a contract's code */
const MAX_DEPLOY_SEARCH_PAGES = 20;

/**
 * Contract code by network, contract and hash: code never changes for a
 * hash, so it is kept (the most recent few)
 */
const MAX_CACHED_CODE = 16;
const codeCache = new Map<string, ContractCode>();

function cacheCode(key: string, code: ContractCode): ContractCode {
	codeCache.delete(key);
	codeCache.set(key, code);
	while (codeCache.size > MAX_CACHED_CODE) {
		const oldest = codeCache.keys().next().value;
		if (oldest === undefined) {
			break;
		}
		codeCache.delete(oldest);
	}
	return(code);
}

function publicKey(account: GenericAccount): string {
	return(account.publicKeyString.get());
}

function sameAccount(left: GenericAccount, right: GenericAccount | string): boolean {
	return(left.comparePublicKey(right));
}

function hashHex(data: Buffer): string {
	return(createHash('sha256').update(data).digest('hex'));
}

function decoded(value: DecodedValue): Decoded {
	return({ value: decodedToPlain(value), decoded: value });
}

function decodedOrError(result: { value?: DecodedValue | undefined, error?: string | undefined } | null): DecodedOrError | null {
	if (!result) {
		return(null);
	}
	if (result.value) {
		return(decoded(result.value));
	}
	return({ error: result.error ?? 'Does not decode' });
}

function effectDetails(effect: ContractEffect): ContractEffectDetails {
	if (effect.kind === 'send') {
		return({
			kind: 'send',
			from: publicKey(effect.from),
			to: publicKey(effect.to),
			token: publicKey(effect.token),
			amount: effect.amount.toString(),
			...(effect.external !== undefined ? { external: effect.external } : {})
		});
	}
	return({ kind: 'setInfo', account: publicKey(effect.account), name: effect.name, description: effect.description, metadata: effect.metadata });
}

/**
 * A contract call in a staple, with what it needs to be described
 */
type CallSite = {
	staple: VoteStaple;
	block: Block;
	operationIndex: number;
	operation: ContractCallOperation;
	funds: { token: string, amount: bigint }[];
	order: number | null;
	outcome: ContractCallOutcome | null;
};

/**
 * Every contract call in a staple, in block and operation order, with its
 * funds, its place in its sequencer's order and its outcome
 */
function stapleCallSites(staple: VoteStaple): CallSite[] {
	let outcomes: ContractCallOutcome[] | null = null;
	try {
		outcomes = stapleContractOutcomes(staple);
	} catch {
		outcomes = null;
	}

	const order = new Map<string, number>();
	for (const block of staple.blocks) {
		for (const operation of blockOperations(block)) {
			if (!isContractOrder(operation)) {
				continue;
			}
			operation.calls.forEach((call, position) => {
				order.set(`${call.block.toString()}:${call.operationIndex}`, position);
			});
		}
	}

	const sites: CallSite[] = [];
	for (const block of staple.blocks) {
		const blockHash = block.hash.toString();
		/* Tokens sent to each contract since the block's last call to it */
		const pending = new Map<string, Map<string, bigint>>();

		blockOperations(block).forEach((operation, operationIndex) => {
			if (operation.type === KeetaNetLib.lib.Block.OperationType.SEND) {
				const send = operation as unknown as { to: GenericAccount, token: GenericAccount, amount: bigint };
				const to = publicKey(send.to);
				const tokens = pending.get(to) ?? new Map<string, bigint>();
				const token = publicKey(send.token);
				tokens.set(token, (tokens.get(token) ?? 0n) + send.amount);
				pending.set(to, tokens);
				return;
			}

			if (!isContractCall(operation)) {
				return;
			}

			const contract = publicKey(operation.contract);
			const funds = [...(pending.get(contract) ?? new Map<string, bigint>()).entries()].map(([token, amount]) => ({ token, amount }));
			pending.delete(contract);

			const outcome = outcomes?.find(candidate => candidate.block.toString() === blockHash && candidate.operationIndex === operationIndex) ?? null;
			sites.push({
				staple,
				block,
				operationIndex,
				operation,
				funds,
				order: order.get(`${blockHash}:${operationIndex}`) ?? null,
				outcome
			});
		});
	}

	return(sites);
}

/**
 * Contracts on a network
 */
export class Contracts {
	readonly #network: Network;
	readonly #verifier: ContractVerifier | null;
	readonly #interfaces = new Map<string, Promise<ContractInterface | null>>();

	constructor(network: Network, verifier: ContractVerifier | null) {
		this.#network = network;
		this.#verifier = verifier;
	}

	/**
	 * The network's client, if it supports contracts
	 */
	get #client(): (ContractClient & InstanceType<typeof KeetaNetLib.Client>) | null {
		const client = this.#network.client;
		return(contractClient(client) ? client as ContractClient & typeof client : null);
	}

	/** Whether this network's client knows contracts */
	get supported(): boolean {
		return(this.#client !== null);
	}

	/** Whether a verifier is configured */
	get hasVerifier(): boolean {
		return(this.#verifier !== null);
	}

	/**
	 * A contract's record, `null` if the account is not a contract (or the
	 * client does not know contracts)
	 */
	async record(contract: string): Promise<ContractRecord | null> {
		const client = this.#client;
		if (!client) {
			return(null);
		}

		const record = await client.getContract(contract);
		if (!record) {
			return(null);
		}

		return({
			publicKey: contract,
			codeHash: record.codeHash.toLowerCase(),
			admin: record.admin ? publicKey(record.admin) : null,
			creator: publicKey(record.creator),
			sequencer: publicKey(record.sequencer)
		});
	}

	/**
	 * A page of the staples that touch a contract, most recent first
	 */
	async history(contract: string, options: { startBlock?: string | undefined, depth?: number | undefined } = {}): Promise<{ staples: VoteStaple[], nextCursor: string | null }> {
		const depth = Math.max(1, Math.min(options.depth ?? 20, MAX_HISTORY_DEPTH));
		const history = await this.#network.client.getHistory(contract, { depth, ...(options.startBlock ? { startBlocksHash: options.startBlock } : {}) });
		const staples = history.map(({ voteStaple }) => voteStaple);
		const nextCursor = staples.length < depth ? null : staples.at(-1)?.blocksHash.toString() ?? null;
		return({ staples, nextCursor });
	}

	/**
	 * A contract's code: from the ledger, or, if the representative cannot
	 * serve it, from the block that deployed it (if its hash is the one the
	 * ledger records)
	 */
	async code(contract: string): Promise<ContractCode | null> {
		const client = this.#client;
		if (!client) {
			return(null);
		}

		const record = await this.record(contract);
		if (!record) {
			return(null);
		}

		const key = `${this.#network.networkId}:${contract}:${record.codeHash}`;
		const cached = codeCache.get(key);
		if (cached) {
			return(cached);
		}

		try {
			const code = await client.getContractCode(contract);
			if (!code) {
				return(null);
			}
			/*
			 * The hash of the bytes served, not the one claimed with them: a
			 * representative (or a custom host for the same network) could
			 * claim the ledger's hash for other code, which would then be
			 * cached and served as this contract's
			 */
			const codeHash = hashHex(code.code);
			const found: ContractCode = { codeHash, code: code.code, source: 'ledger' };
			return(codeHash === record.codeHash ? cacheCode(key, found) : found);
		} catch (error) {
			const deployed = await this.#deployedCode(contract, record.codeHash);
			if (!deployed) {
				throw(error);
			}
			return(cacheCode(key, { codeHash: record.codeHash, code: deployed, source: 'deploy-block' }));
		}
	}

	async #deployedCode(contract: string, codeHash: string): Promise<Buffer | null> {
		let startBlock: string | undefined;
		for (let page = 0; page < MAX_DEPLOY_SEARCH_PAGES; page++) {
			const { staples, nextCursor } = await this.history(contract, { startBlock, depth: MAX_HISTORY_DEPTH });
			for (const staple of staples) {
				for (const block of staple.blocks) {
					for (const operation of blockOperations(block)) {
						if (isContractDeploy(operation) && sameAccount(operation.contract, contract) && hashHex(operation.code) === codeHash) {
							return(operation.code);
						}
					}
				}
			}
			if (!nextCursor) {
				return(null);
			}
			startBlock = nextCursor;
		}
		return(null);
	}

	/**
	 * The contract's deployments in a page of its history
	 */
	deploymentsIn(contract: string, staples: VoteStaple[]): ContractDeployDetails[] {
		return(staples.flatMap(staple => staple.blocks.flatMap(block => blockOperations(block).flatMap((operation, operationIndex) => {
			if (!isContractDeploy(operation) || !sameAccount(operation.contract, contract)) {
				return([]);
			}
			return([{
				voteStapleHash: staple.blocksHash.toString(),
				block: block.hash.toString(),
				operationIndex,
				date: block.date.toISOString(),
				creator: publicKey(block.account),
				contract,
				codeHash: hashHex(operation.code),
				codeSize: operation.code.length,
				sequencer: publicKey(operation.sequencer),
				admin: operation.admin ? publicKey(operation.admin) : null
			}]);
		}))));
	}

	/**
	 * The verifier's result for a contract, `null` if no verifier is
	 * configured
	 */
	async verification(contract: string): Promise<ContractVerificationStatus | null> {
		if (!this.#verifier) {
			return(null);
		}
		return(await this.#verifier.status(contract));
	}

	get verifier(): ContractVerifier | null {
		return(this.#verifier);
	}

	/**
	 * The interface of a contract's current code: from its verification,
	 * if the code verified is the code deployed
	 */
	async interfaceOf(contract: string): Promise<ContractInterface | null> {
		let found = this.#interfaces.get(contract);
		if (!found) {
			found = this.#interfaceOf(contract);
			this.#interfaces.set(contract, found);
		}
		return(await found);
	}

	async #interfaceOf(contract: string): Promise<ContractInterface | null> {
		if (!this.#verifier) {
			return(null);
		}

		const [record, status] = await Promise.all([
			this.record(contract),
			this.#verifier.status(contract).catch(() => null)
		]);
		const verification = status?.verification;
		if (!record || !verification || verification.codeHash.toLowerCase() !== record.codeHash) {
			return(null);
		}
		return(verification.interface);
	}

	/**
	 * Describe state accounts, matching each to a kind of account of the
	 * contract's interface
	 */
	describeStateAccounts(
		owner: string,
		accounts: { id: Buffer, version: bigint, data: Buffer | null }[],
		contractInterface: ContractInterface | null,
		candidates: string[]
	): StateAccountDetails[] {
		const matches = contractInterface
			? matchStateAccounts(contractInterface, accounts, [...new Set(candidates)])
			: accounts.map((): StateAccountMatch => ({ kind: null, matchedBy: null }));

		return(accounts.map((account, index) => {
			const match = matches[index];
			return({
				owner,
				id: account.id.toString('hex'),
				version: account.version.toString(),
				data: account.data === null ? null : account.data.toString('hex'),
				size: account.data?.length ?? 0,
				kind: match.kind,
				matchedBy: match.matchedBy,
				...(match.seeds ? { seeds: match.seeds } : {}),
				...(match.alsoDecodesAs ? { alsoDecodesAs: match.alsoDecodesAs } : {}),
				...(match.decoded ? { value: decodedToPlain(match.decoded), decoded: match.decoded } : {}),
				...(match.error ? { error: match.error } : {})
			});
		}));
	}

	/**
	 * Accounts likely to be address seeds of a contract's state: the
	 * contract and its record's accounts, and the callers (and accounts
	 * their instructions name) of its recent calls
	 */
	async #stateCandidates(contract: string, record: ContractRecord, contractInterface: ContractInterface): Promise<string[]> {
		const candidates = [contract, record.creator, record.sequencer, ...(record.admin ? [record.admin] : [])];
		try {
			const { staples } = await this.history(contract, { depth: MAX_HISTORY_DEPTH });
			for (const site of staples.flatMap(stapleCallSites)) {
				if (!sameAccount(site.operation.contract, contract)) {
					continue;
				}
				candidates.push(publicKey(site.block.account));
				const instruction = decodeInstruction(contractInterface, site.operation.data);
				if (instruction?.value) {
					candidates.push(...addressesIn(instruction.value));
				}
			}
		} catch {
			/* Without history, the record's accounts and decoding by type remain */
		}
		return(candidates);
	}

	/**
	 * A page of a contract's state accounts, in id order, decoded
	 */
	async state(contract: string, options: { startAfter?: string | undefined, limit?: number | undefined } = {}): Promise<{ states: StateAccountDetails[], nextCursor: string | null, interfaceKnown: boolean } | null> {
		const client = this.#client;
		if (!client) {
			return(null);
		}

		const record = await this.record(contract);
		if (!record) {
			return(null);
		}

		const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_STATE_LIMIT, MAX_STATE_LIMIT));
		const [states, contractInterface] = await Promise.all([
			client.listContractState(contract, { limit, ...(options.startAfter ? { startAfter: options.startAfter } : {}) }),
			this.interfaceOf(contract)
		]);

		const candidates = contractInterface ? await this.#stateCandidates(contract, record, contractInterface) : [];
		const described = this.describeStateAccounts(contract, states, contractInterface, candidates);
		const nextCursor = states.length < limit ? null : described.at(-1)?.id ?? null;

		return({ states: described, nextCursor, interfaceKnown: contractInterface !== null });
	}

	/**
	 * Describe a call: its instruction and outcome, decoded with its
	 * contract's interface
	 */
	async #describeCall(site: CallSite): Promise<ContractCallDetails> {
		const { block, operation, outcome } = site;
		const contract = publicKey(operation.contract);
		const caller = publicKey(block.account);
		const contractInterface = await this.interfaceOf(contract).catch(() => null);

		const instructionResult = contractInterface ? decodeInstruction(contractInterface, operation.data) : null;
		const instruction = decodedOrError(instructionResult);

		const candidates = [caller, contract, ...(instructionResult?.value ? addressesIn(instructionResult.value) : [])];
		const kindOf = (accounts: { owner: GenericAccount, id: Buffer }[]): (string | null)[] => {
			if (!contractInterface) {
				return(accounts.map(() => null));
			}
			const own = accounts.map(account => ({ id: account.id, data: null, owned: sameAccount(account.owner, contract) }));
			const matches = matchStateAccounts(contractInterface, own.map(({ id }) => ({ id, data: null })), candidates);
			return(matches.map((match, index) => own[index].owned ? match.kind : null));
		};

		const accountKinds = kindOf(operation.accounts);

		let outcomeDetails: ContractCallOutcomeDetails | null = null;
		if (outcome) {
			const readKinds = kindOf(outcome.reads);
			const writes = outcome.writes.map(write => {
				const owner = publicKey(write.owner);
				const ownInterface = sameAccount(write.owner, contract) ? contractInterface : null;
				return(this.describeStateAccounts(owner, [{ id: write.id, version: write.version, data: write.data ?? null }], ownInterface, candidates)[0]);
			});

			outcomeDetails = {
				gasUsed: outcome.gasUsed.toString(),
				returnData: outcome.returnData.toString('hex'),
				returned: contractInterface ? decodedOrError(decodeReturnData(contractInterface, instructionResult?.value, outcome.returnData)) : null,
				reads: outcome.reads.map((read, index) => ({ owner: publicKey(read.owner), id: read.id.toString('hex'), version: read.version.toString(), kind: readKinds[index] })),
				writes,
				effects: outcome.effects.map(effectDetails),
				failure: outcome.failure ? { kind: outcome.failure.kind, message: outcome.failure.message } : null
			};
		}

		return({
			voteStapleHash: site.staple.blocksHash.toString(),
			block: block.hash.toString(),
			operationIndex: site.operationIndex,
			date: block.date.toISOString(),
			caller,
			contract,
			gasLimit: operation.gasLimit.toString(),
			data: operation.data.toString('hex'),
			accounts: operation.accounts.map((account, index) => ({ owner: publicKey(account.owner), id: account.id.toString('hex'), writable: account.writable, kind: accountKinds[index] })),
			funds: site.funds.map(({ token, amount }) => ({ token, amount: amount.toString() })),
			order: site.order,
			instruction,
			outcome: outcomeDetails
		});
	}

	/**
	 * A page of a contract's calls, most recent first, with the deployments
	 * in the same page of history
	 */
	async calls(contract: string, options: { startBlock?: string | undefined, depth?: number | undefined } = {}): Promise<{ calls: ContractCallDetails[], deployments: ContractDeployDetails[], nextCursor: string | null } | null> {
		if (!this.supported) {
			return(null);
		}

		const { staples, nextCursor } = await this.history(contract, options);
		const sites = staples.flatMap(staple => {
			/* A staple's calls to this contract, in the order they ran */
			const calls = stapleCallSites(staple).filter(site => sameAccount(site.operation.contract, contract));
			return(calls.sort((left, right) => (left.order ?? Infinity) - (right.order ?? Infinity)).reverse());
		});

		return({
			calls: await Promise.all(sites.map(site => this.#describeCall(site))),
			deployments: this.deploymentsIn(contract, staples),
			nextCursor
		});
	}

	/**
	 * The contract calls in the staple holding a block, in order
	 */
	async stapleCalls(blockhash: string): Promise<{ voteStapleHash: string, calls: ContractCallDetails[], hasOutcomes: boolean } | null> {
		const staple = await this.#network.client.getVoteStaple(blockhash);
		if (!staple) {
			return(null);
		}

		const sites = stapleCallSites(staple);
		return({
			voteStapleHash: staple.blocksHash.toString(),
			calls: await Promise.all(sites.map(site => this.#describeCall(site))),
			hasOutcomes: sites.some(site => site.outcome !== null)
		});
	}
}
