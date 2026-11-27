/**
 * Fixtures for the contract tests: the interface of the example virtual pet
 * contract (as the verifier publishes it), state accounts it wrote on a
 * local network, and a small borsh encoder to build more.
 */
import { KeetaNetLib } from '@/utils/keetanet';
import { encodeAddress } from './address';

export const petInterface = {
	format: 'keeta-contract-interface',
	name: 'keeta-pet',
	instruction: 'Instruction',
	accounts: [
		{ name: 'config', type: 'Config', seeds: [{ bytes: '636f6e666967' }] },
		{ name: 'pet', type: 'Pet', seeds: [{ bytes: '706574' }, { address: 'owner' }] }
	],
	views: [{ instruction: 'Pets', returns: 'Vec<PetView>' }],
	types: {
		Address: { kind: 'address' },
		Config: { kind: 'struct', fields: [{ name: 'admin', type: 'Address' }, { name: 'food_token', type: 'Address' }, { name: 'food_price', type: 'u128' }] },
		Instruction: {
			kind: 'enum',
			tagWidth: 1,
			variants: [
				{ discriminant: 0, name: 'Init', type: 'Instruction__Init' },
				{ discriminant: 1, name: 'Adopt', type: 'Instruction__Adopt' },
				{ discriminant: 2, name: 'Feed', type: 'Instruction__Feed' },
				{ discriminant: 3, name: 'Play', type: 'Instruction__Play' },
				{ discriminant: 4, name: 'Withdraw', type: 'Instruction__Withdraw' },
				{ discriminant: 5, name: 'Pets', type: 'Instruction__Pets' }
			]
		},
		Instruction__Adopt: { kind: 'struct', fields: [{ name: 'name', type: 'String' }] },
		Instruction__Feed: { kind: 'struct', fields: [] },
		Instruction__Init: { kind: 'struct', fields: [{ name: 'food_token', type: 'Address' }, { name: 'food_price', type: 'u128' }] },
		Instruction__Pets: { kind: 'struct', fields: [] },
		Instruction__Play: { kind: 'struct', fields: [] },
		Instruction__Withdraw: { kind: 'struct', fields: [{ name: 'to', type: 'Address' }] },
		Mood: {
			kind: 'enum',
			tagWidth: 1,
			variants: [
				{ discriminant: 0, name: 'Happy', type: 'Mood__Happy' },
				{ discriminant: 1, name: 'Content', type: 'Mood__Content' },
				{ discriminant: 2, name: 'Hungry', type: 'Mood__Hungry' },
				{ discriminant: 3, name: 'Bored', type: 'Mood__Bored' },
				{ discriminant: 4, name: 'Starving', type: 'Mood__Starving' },
				{ discriminant: 5, name: 'RanAway', type: 'Mood__RanAway' }
			]
		},
		Mood__Bored: { kind: 'struct', fields: [] },
		Mood__Content: { kind: 'struct', fields: [] },
		Mood__Happy: { kind: 'struct', fields: [] },
		Mood__Hungry: { kind: 'struct', fields: [] },
		Mood__RanAway: { kind: 'struct', fields: [] },
		Mood__Starving: { kind: 'struct', fields: [] },
		Pet: {
			kind: 'struct',
			fields: [
				{ name: 'owner', type: 'Address' },
				{ name: 'name', type: 'String' },
				{ name: 'born', type: 'u64' },
				{ name: 'updated', type: 'u64' },
				{ name: 'fullness', type: 'u64' },
				{ name: 'happiness', type: 'u64' },
				{ name: 'meals', type: 'u64' },
				{ name: 'plays', type: 'u64' }
			]
		},
		PetView: {
			kind: 'struct',
			fields: [
				{ name: 'owner', type: 'Address' },
				{ name: 'name', type: 'String' },
				{ name: 'born', type: 'u64' },
				{ name: 'age_seconds', type: 'u64' },
				{ name: 'fullness', type: 'u64' },
				{ name: 'happiness', type: 'u64' },
				{ name: 'mood', type: 'Mood' },
				{ name: 'meals', type: 'u64' },
				{ name: 'plays', type: 'u64' }
			]
		},
		String: { kind: 'sequence', lengthWidth: 4, elements: 'u8' },
		'Vec<PetView>': { kind: 'sequence', lengthWidth: 4, elements: 'PetView' },
		u128: { kind: 'primitive', size: 16 },
		u64: { kind: 'primitive', size: 8 },
		u8: { kind: 'primitive', size: 1 }
	}
};

/** State accounts the pet contract wrote on a local network: its config and a pet */
export const petConfigAccount = {
	id: 'b79606fb3afea5bd1609ed40b622142f1c98125abcfe89a76a661b0e8e343910',
	data: '0002afe93833d2ffce619526f2b7a0793c3daa4d1cd1137f067a4f06eef48ed3fd160370829795df00bad194780cc1e1d2c0c90d7162e0c85eb22f63307bed3eaa754a000000c16ff28623000000000000000000',
	admin: 'keeta_aabk72jygpjp7ttbsutpfn5ape6d3ksndtirg7ygpjhqn3xur3j72ftwygzazna',
	foodToken: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
	foodPrice: '10000000000000000'
};

export const petAccount = {
	id: 'e749800b19be5a47d25ad78ca0022e11564a11287e262eec2d13d27505b30cf9',
	data: '000306c11c3ba7020760b73197d6cb387b4f1c3f1cd6290d45a6a5d327f57e0e318205000000536d6f6b65b201f26a00000000b201f26a000000007011010000000000a08601000000000001000000000000000200000000000000',
	owner: 'keeta_aabqnqi4hotqeb3aw4yzpvwlhb5u6hb7dtlcsdkfu2s5gj7vpyhddavxoltuv6i',
	name: 'Smoke'
};

/**
 * A minimal borsh encoder, to build test data
 */
export const encode = {
	u8: (value: number) => Buffer.from([value]),
	unsigned(value: bigint | number, size: number): Buffer {
		const out = Buffer.alloc(size);
		let remaining = BigInt(value);
		if (remaining < 0n) {
			remaining += 1n << BigInt(size * 8);
		}
		for (let index = 0; index < size; index++) {
			out[index] = Number(remaining & 0xffn);
			remaining >>= 8n;
		}
		return(out);
	},
	u32: (value: number) => encode.unsigned(value, 4),
	u64: (value: bigint | number) => encode.unsigned(value, 8),
	u128: (value: bigint | number) => encode.unsigned(value, 16),
	string(value: string): Buffer {
		const bytes = Buffer.from(value, 'utf-8');
		return(Buffer.concat([encode.u32(bytes.length), bytes]));
	},
	address: (account: string) => encodeAddress(account)
};

export function petData(owner: string, name: string, values: { born: number, updated: number, fullness: number, happiness: number, meals: number, plays: number }): Buffer {
	return(Buffer.concat([
		encode.address(owner),
		encode.string(name),
		encode.u64(values.born),
		encode.u64(values.updated),
		encode.u64(values.fullness),
		encode.u64(values.happiness),
		encode.u64(values.meals),
		encode.u64(values.plays)
	]));
}

/** A fresh account of the given key type */
export function testAccount(keyType: number = KeetaNetLib.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256K1, index = 0): string {
	const seed = KeetaNetLib.lib.Account.generateRandomSeed();
	return(KeetaNetLib.lib.Account.fromSeed(seed, index, keyType as typeof KeetaNetLib.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256K1).publicKeyString.get());
}
