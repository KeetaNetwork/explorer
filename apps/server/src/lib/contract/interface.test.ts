import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decodedToPlain } from './borsh';
import { decodeInstruction, decodeReturnData, encodeSeeds, matchStateAccounts, parseContractInterface, stateAccountId, type ContractInterface } from './interface';
import { encode, petAccount, petConfigAccount, petData, petInterface, testAccount } from './test-fixtures';

function hex(value: string): Buffer {
	return(Buffer.from(value, 'hex'));
}

function petInterfaceParsed(): ContractInterface {
	const parsed = parseContractInterface(petInterface);
	assert.ok(parsed);
	return(parsed);
}

const pet = { born: 1, updated: 2, fullness: 3, happiness: 4, meals: 5, plays: 6 };

describe('contract interfaces', () => {
	test('the pet contract\'s interface parses', () => {
		const parsed = petInterfaceParsed();
		assert.equal(parsed.name, 'keeta-pet');
		assert.equal(parsed.accounts.length, 2);
		assert.equal(parsed.views[0].returns, 'Vec<PetView>');
	});

	test('anything else is refused', () => {
		assert.equal(parseContractInterface(null), null);
		assert.equal(parseContractInterface({ ...petInterface, format: 'some-other-format' }), null);
		assert.equal(parseContractInterface({ ...petInterface, types: { u8: { kind: 'pointer' } } }), null);
		assert.equal(parseContractInterface({ ...petInterface, accounts: [{ name: 'x', type: 'u8', seeds: [{ bytes: 'not hex' }] }] }), null);
		assert.equal(parseContractInterface({ ...petInterface, accounts: Array.from({ length: 257 }, (_, index) => ({ name: `kind${index}`, type: 'u8' })) }), null);
	});

	test('accounts and views are optional', () => {
		const parsed = parseContractInterface({ format: 'keeta-contract-interface', types: {} });
		assert.ok(parsed);
		assert.deepEqual(parsed.accounts, []);
		assert.deepEqual(parsed.views, []);
	});
});

describe('instructions', () => {
	const contractInterface = petInterfaceParsed();

	test('instruction data decodes as the instruction type', () => {
		assert.equal(decodedToPlain(decodeInstruction(contractInterface, hex('02'))!.value!), 'Feed');

		const adopt = decodeInstruction(contractInterface, Buffer.concat([hex('01'), encode.string('Rex')]));
		assert.deepEqual(decodedToPlain(adopt!.value!), { Adopt: { name: 'Rex' } });

		const withdraw = decodeInstruction(contractInterface, Buffer.concat([hex('04'), encode.address(petAccount.owner)]));
		assert.deepEqual(decodedToPlain(withdraw!.value!), { Withdraw: { to: petAccount.owner } });
	});

	test('data that does not decode gives an error', () => {
		const result = decodeInstruction(contractInterface, hex('09'));
		assert.ok(result?.error);
		assert.match(result.error, /discriminant 9/);
		assert.ok(decodeInstruction(contractInterface, hex('0200'))?.error);
	});

	test('without an instruction type there is nothing to decode', () => {
		assert.equal(decodeInstruction({ ...contractInterface, instruction: undefined }, hex('02')), null);
	});

	test('a view\'s return data decodes as its return type', () => {
		const instruction = decodeInstruction(contractInterface, hex('05'))!.value!;
		const view = Buffer.concat([
			encode.u32(1),
			encode.address(petAccount.owner),
			encode.string('Rex'),
			encode.u64(1), encode.u64(2), encode.u64(3), encode.u64(4),
			hex('02'),
			encode.u64(5), encode.u64(6)
		]);
		const decoded = decodeReturnData(contractInterface, instruction, view);
		assert.deepEqual(decodedToPlain(decoded!.value!), [{
			owner: petAccount.owner, name: 'Rex', born: '1', age_seconds: '2', fullness: '3', happiness: '4', mood: 'Hungry', meals: '5', plays: '6'
		}]);

		const feed = decodeInstruction(contractInterface, hex('02'))!.value!;
		assert.equal(decodeReturnData(contractInterface, feed, view), null);
		assert.equal(decodeReturnData(contractInterface, instruction, hex('')), null);
	});
});

describe('state account ids', () => {
	const contractInterface = petInterfaceParsed();
	const [configKind, petKind] = contractInterface.accounts;

	test('an id is SHA-256 of the seeds, concatenated', () => {
		assert.equal(stateAccountId([Buffer.from('config')]).toString('hex'), petConfigAccount.id);
		assert.equal(stateAccountId(encodeSeeds(configKind, {})).toString('hex'), petConfigAccount.id);
		assert.equal(stateAccountId([Buffer.from('pet'), encode.address(petAccount.owner)]).toString('hex'), petAccount.id);
		assert.equal(stateAccountId(encodeSeeds(petKind, { owner: petAccount.owner })).toString('hex'), petAccount.id);
	});

	test('address seeds need an account', () => {
		assert.throws(() => encodeSeeds(petKind, {}), /No account for seed "owner"/);
	});
});

describe('matching state accounts to kinds', () => {
	const contractInterface = petInterfaceParsed();

	test('fixed seeds match by id; address seeds match with the right candidate', () => {
		const [config, matchedPet] = matchStateAccounts(contractInterface, [
			{ id: petConfigAccount.id, data: hex(petConfigAccount.data) },
			{ id: petAccount.id, data: hex(petAccount.data) }
		], [testAccount(), petAccount.owner]);

		assert.equal(config.kind, 'config');
		assert.equal(config.matchedBy, 'seeds');
		assert.equal(config.seeds, undefined);
		assert.deepEqual(decodedToPlain(config.decoded!), { admin: petConfigAccount.admin, food_token: petConfigAccount.foodToken, food_price: petConfigAccount.foodPrice });

		assert.equal(matchedPet.kind, 'pet');
		assert.equal(matchedPet.matchedBy, 'seeds');
		assert.deepEqual(matchedPet.seeds, { owner: petAccount.owner });
		assert.equal((decodedToPlain(matchedPet.decoded!) as { name: string }).name, 'Smoke');
	});

	test('without the owner as a candidate, a pet decoded by its type names its owner, which its id confirms', () => {
		const [matchedPet] = matchStateAccounts(contractInterface, [{ id: petAccount.id, data: hex(petAccount.data) }], []);
		assert.equal(matchedPet.kind, 'pet');
		assert.equal(matchedPet.matchedBy, 'seeds');
		assert.deepEqual(matchedPet.seeds, { owner: petAccount.owner });
	});

	test('an account whose id no candidate gives is matched by its type', () => {
		const [matchedPet] = matchStateAccounts(contractInterface, [{ id: Buffer.alloc(32, 7), data: hex(petAccount.data) }], []);
		assert.equal(matchedPet.kind, 'pet');
		assert.equal(matchedPet.matchedBy, 'type');
		assert.equal(matchedPet.seeds, undefined);
		assert.equal(matchedPet.alsoDecodesAs, undefined);
		assert.equal((decodedToPlain(matchedPet.decoded!) as { owner: string }).owner, petAccount.owner);
	});

	test('accounts named in decoded state are tried as candidates', () => {
		const adminPet = petData(petConfigAccount.admin, 'Admin\'s', pet);
		const adminPetId = stateAccountId([Buffer.from('pet'), encode.address(petConfigAccount.admin)]);
		const [, matchedPet] = matchStateAccounts(contractInterface, [
			{ id: petConfigAccount.id, data: hex(petConfigAccount.data) },
			{ id: adminPetId, data: adminPet }
		], []);
		assert.equal(matchedPet.matchedBy, 'seeds');
		assert.deepEqual(matchedPet.seeds, { owner: petConfigAccount.admin });
	});

	test('an id matched by seeds whose data does not decode keeps the kind and the error', () => {
		const [config] = matchStateAccounts(contractInterface, [{ id: petConfigAccount.id, data: hex('00') }], []);
		assert.equal(config.kind, 'config');
		assert.equal(config.matchedBy, 'seeds');
		assert.equal(config.decoded, undefined);
		assert.match(config.error!, /Expected 34 bytes/);
	});

	test('nothing matches unknown data', () => {
		const [unknown] = matchStateAccounts(contractInterface, [{ id: Buffer.alloc(32, 1), data: hex('deadbeef') }], [petAccount.owner]);
		assert.deepEqual(unknown, { kind: null, matchedBy: null });
	});

	test('ambiguous type matches name the other kinds', () => {
		const ambiguous: ContractInterface = {
			...contractInterface,
			accounts: [
				{ name: 'counter', type: 'u64', seeds: [{ bytes: '01' }] },
				{ name: 'total', type: 'u64' }
			]
		};
		const [match] = matchStateAccounts(ambiguous, [{ id: Buffer.alloc(32), data: encode.u64(5) }], []);
		assert.equal(match.kind, 'counter');
		assert.equal(match.matchedBy, 'type');
		assert.deepEqual(match.alsoDecodesAs, ['total']);
	});

	test('the ids tried for address seeds are bounded, and each candidate is encoded once', () => {
		const owner = testAccount();
		const many: ContractInterface = {
			...contractInterface,
			accounts: [
				{ name: 'pair', type: 'u8', seeds: [{ bytes: '01' }, { address: 'a' }, { address: 'b' }] },
				...Array.from({ length: 255 }, (_, index) => ({ name: `kind${index}`, type: 'u8', seeds: [{ bytes: '02' }, { address: 'a' }, { address: 'b' }] }))
			]
		};
		const candidates = [owner, ...Array.from({ length: 63 }, () => testAccount())];
		const id = stateAccountId([hex('01'), encode.address(owner), encode.address(candidates[1])]);
		const start = performance.now();
		const [match] = matchStateAccounts(many, [{ id, data: hex('07') }], candidates);
		assert.ok(performance.now() - start < 2_000, 'matching took too long');
		assert.equal(match.kind, 'pair');
		assert.deepEqual(match.seeds, { a: owner, b: candidates[1] });
	});

	test('ids given as hex in either case match', () => {
		const [config] = matchStateAccounts(contractInterface, [{ id: petConfigAccount.id.toUpperCase(), data: hex(petConfigAccount.data) }], []);
		assert.equal(config.matchedBy, 'seeds');
	});
});
