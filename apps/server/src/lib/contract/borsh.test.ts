import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { KeetaNetLib } from '@/utils/keetanet';
import { addressesIn, BorshDecodeError, decodeBorsh, decodeBorshExact, decodedToPlain, tryDecodeBorshExact, type BorshSchema } from './borsh';
import { decodeAddress, encodeAddress } from './address';
import { encode, petAccount, petConfigAccount, petInterface, testAccount } from './test-fixtures';

const { AccountKeyAlgorithm } = KeetaNetLib.lib.Account;

const schema: BorshSchema = {
	u8: { kind: 'primitive', size: 1 },
	u16: { kind: 'primitive', size: 2 },
	u32: { kind: 'primitive', size: 4 },
	u64: { kind: 'primitive', size: 8 },
	u128: { kind: 'primitive', size: 16 },
	i8: { kind: 'primitive', size: 1 },
	i32: { kind: 'primitive', size: 4 },
	i128: { kind: 'primitive', size: 16 },
	f32: { kind: 'primitive', size: 4 },
	f64: { kind: 'primitive', size: 8 },
	bool: { kind: 'primitive', size: 1 },
	'()': { kind: 'primitive', size: 0 },
	Address: { kind: 'address' },
	String: { kind: 'sequence', lengthWidth: 4, elements: 'u8' },
	'Vec<u8>': { kind: 'sequence', lengthWidth: 4, elements: 'u8' },
	'[u8; 4]': { kind: 'sequence', length: 4, elements: 'u8' },
	'[u16; 2]': { kind: 'sequence', length: 2, elements: 'u16' },
	'Vec<u64>': { kind: 'sequence', lengthWidth: 4, elements: 'u64' },
	'ShortVec<u8>': { kind: 'sequence', lengthWidth: 1, elements: 'u8' },
	'Vec<()>': { kind: 'sequence', lengthWidth: 4, elements: '()' },
	'(u8, bool)': { kind: 'tuple', elements: ['u8', 'bool'] },
	Point: { kind: 'struct', fields: [{ name: 'x', type: 'i32' }, { name: 'y', type: 'i32' }] },
	Pair: { kind: 'struct', fields: ['u8', 'String'] },
	Empty: { kind: 'struct', fields: [] },
	'Option<u64>': {
		kind: 'enum',
		tagWidth: 1,
		variants: [
			{ discriminant: 0, name: 'None', type: 'Option<u64>__None' },
			{ discriminant: 1, name: 'Some', type: 'Option<u64>__Some' }
		]
	},
	'Option<u64>__None': { kind: 'struct', fields: [] },
	'Option<u64>__Some': { kind: 'struct', fields: ['u64'] },
	Wide: {
		kind: 'enum',
		tagWidth: 2,
		variants: [
			{ discriminant: 0, name: 'Nothing' },
			{ discriminant: 300, name: 'Point', type: 'Point' },
			{ discriminant: 301, name: 'Pair', type: '(u8, bool)' }
		]
	},
	Tree: { kind: 'struct', fields: [{ name: 'children', type: 'Vec<Tree>' }] },
	'Vec<Tree>': { kind: 'sequence', lengthWidth: 4, elements: 'Tree' },
	Bogus: { kind: 'struct', fields: [{ name: 'missing', type: 'NotAType' }] }
};

function hex(value: string): Buffer {
	return(Buffer.from(value, 'hex'));
}

describe('borsh primitives', () => {
	test('unsigned integers are little-endian', () => {
		assert.deepEqual(decodeBorshExact(schema, 'u8', hex('ff')), { kind: 'integer', type: 'u8', value: '255' });
		assert.deepEqual(decodeBorshExact(schema, 'u16', hex('3412')), { kind: 'integer', type: 'u16', value: String(0x1234) });
		assert.deepEqual(decodeBorshExact(schema, 'u64', encode.u64(2n ** 64n - 1n)), { kind: 'integer', type: 'u64', value: (2n ** 64n - 1n).toString() });
		assert.deepEqual(decodeBorshExact(schema, 'u128', encode.u128(10n ** 30n)), { kind: 'integer', type: 'u128', value: (10n ** 30n).toString() });
	});

	test('signed integers are two\'s complement', () => {
		assert.deepEqual(decodeBorshExact(schema, 'i8', hex('ff')), { kind: 'integer', type: 'i8', value: '-1' });
		assert.deepEqual(decodeBorshExact(schema, 'i8', hex('7f')), { kind: 'integer', type: 'i8', value: '127' });
		assert.deepEqual(decodeBorshExact(schema, 'i32', encode.unsigned(-123456, 4)), { kind: 'integer', type: 'i32', value: '-123456' });
		assert.deepEqual(decodeBorshExact(schema, 'i128', encode.unsigned(-(2n ** 127n), 16)), { kind: 'integer', type: 'i128', value: (-(2n ** 127n)).toString() });
	});

	test('floats', () => {
		const f32 = Buffer.alloc(4);
		f32.writeFloatLE(1.5);
		assert.deepEqual(decodeBorshExact(schema, 'f32', f32), { kind: 'float', type: 'f32', value: 1.5 });
		const f64 = Buffer.alloc(8);
		f64.writeDoubleLE(-0.1);
		assert.deepEqual(decodeBorshExact(schema, 'f64', f64), { kind: 'float', type: 'f64', value: -0.1 });
	});

	test('bool is one byte, 0 or 1', () => {
		assert.deepEqual(decodeBorshExact(schema, 'bool', hex('01')), { kind: 'bool', value: true });
		assert.deepEqual(decodeBorshExact(schema, 'bool', hex('00')), { kind: 'bool', value: false });
		assert.throws(() => decodeBorshExact(schema, 'bool', hex('02')), BorshDecodeError);
	});

	test('the unit type takes no bytes', () => {
		assert.deepEqual(decodeBorshExact(schema, '()', hex('')), { kind: 'unit' });
	});

	test('primitives borsh names need not be listed', () => {
		assert.deepEqual(decodeBorshExact({}, 'u32', hex('01000000')), { kind: 'integer', type: 'u32', value: '1' });
	});
});

describe('borsh sequences', () => {
	test('String is length-prefixed UTF-8', () => {
		assert.deepEqual(decodeBorshExact(schema, 'String', encode.string('héllo ✓')), { kind: 'string', value: 'héllo ✓' });
		assert.deepEqual(decodeBorshExact(schema, 'String', encode.string('')), { kind: 'string', value: '' });
		assert.throws(() => decodeBorshExact(schema, 'String', Buffer.concat([encode.u32(2), hex('c328')])), /not valid UTF-8/);
	});

	test('other byte sequences are bytes', () => {
		assert.deepEqual(decodeBorshExact(schema, 'Vec<u8>', Buffer.concat([encode.u32(3), hex('0a0b0c')])), { kind: 'bytes', type: 'Vec<u8>', hex: '0a0b0c' });
		assert.deepEqual(decodeBorshExact(schema, '[u8; 4]', hex('deadbeef')), { kind: 'bytes', type: '[u8; 4]', hex: 'deadbeef' });
		assert.deepEqual(decodeBorshExact(schema, 'ShortVec<u8>', hex('02aabb')), { kind: 'bytes', type: 'ShortVec<u8>', hex: 'aabb' });
	});

	test('fixed-length arrays have no prefix', () => {
		const value = decodeBorshExact(schema, '[u16; 2]', hex('01000200'));
		assert.deepEqual(decodedToPlain(value), [1, 2]);
	});

	test('vectors of values', () => {
		const value = decodeBorshExact(schema, 'Vec<u64>', Buffer.concat([encode.u32(2), encode.u64(7), encode.u64(2n ** 63n)]));
		assert.equal(value.kind, 'sequence');
		assert.deepEqual(decodedToPlain(value), ['7', (2n ** 63n).toString()]);
	});

	test('a length the data cannot hold is refused before decoding', () => {
		assert.throws(() => decodeBorshExact(schema, 'Vec<u64>', Buffer.concat([encode.u32(0xffffffff), encode.u64(1)])), /more than the 8 bytes left/);
		assert.throws(() => decodeBorshExact(schema, 'Vec<()>', encode.u32(0xffffffff)), /empty elements/);
		assert.deepEqual(decodedToPlain(decodeBorshExact(schema, 'Vec<()>', encode.u32(2))), [null, null]);
	});
});

describe('borsh structs, enums and tuples', () => {
	test('named structs', () => {
		const value = decodeBorshExact(schema, 'Point', Buffer.concat([encode.unsigned(-1, 4), encode.unsigned(2, 4)]));
		assert.deepEqual(value, {
			kind: 'struct',
			type: 'Point',
			fields: [
				{ name: 'x', value: { kind: 'integer', type: 'i32', value: '-1' } },
				{ name: 'y', value: { kind: 'integer', type: 'i32', value: '2' } }
			]
		});
		assert.deepEqual(decodedToPlain(value), { x: -1, y: 2 });
	});

	test('tuple structs and empty structs', () => {
		const pair = decodeBorshExact(schema, 'Pair', Buffer.concat([encode.u8(9), encode.string('nine')]));
		assert.deepEqual(decodedToPlain(pair), [9, 'nine']);
		assert.deepEqual(decodeBorshExact(schema, 'Empty', hex('')), { kind: 'struct', type: 'Empty', fields: [] });
	});

	test('tuples', () => {
		assert.deepEqual(decodedToPlain(decodeBorshExact(schema, '(u8, bool)', hex('0501'))), [5, true]);
	});

	test('enums: variants hold the fields of their struct', () => {
		const none = decodeBorshExact(schema, 'Option<u64>', hex('00'));
		assert.deepEqual(none, { kind: 'enum', type: 'Option<u64>', variant: 'None', discriminant: 0, fields: [] });
		assert.equal(decodedToPlain(none), 'None');

		const some = decodeBorshExact(schema, 'Option<u64>', Buffer.concat([hex('01'), encode.u64(42)]));
		assert.equal(some.kind === 'enum' && some.variant, 'Some');
		assert.deepEqual(decodedToPlain(some), { Some: '42' });
	});

	test('enums with wider tags and non-struct variants', () => {
		const point = decodeBorshExact(schema, 'Wide', Buffer.concat([encode.unsigned(300, 2), encode.unsigned(3, 4), encode.unsigned(4, 4)]));
		assert.deepEqual(decodedToPlain(point), { Point: { x: 3, y: 4 } });
		const pair = decodeBorshExact(schema, 'Wide', Buffer.concat([encode.unsigned(301, 2), hex('0700')]));
		assert.deepEqual(decodedToPlain(pair), { Pair: [7, false] });
		assert.equal(decodedToPlain(decodeBorshExact(schema, 'Wide', hex('0000'))), 'Nothing');
	});

	test('an unknown discriminant is refused', () => {
		assert.throws(() => decodeBorshExact(schema, 'Option<u64>', hex('02')), /No variant of Option<u64> has discriminant 2/);
	});

	test('recursive types decode, and nesting is bounded', () => {
		const leaf = encode.u32(0);
		const tree = Buffer.concat([encode.u32(2), leaf, leaf]);
		assert.deepEqual(decodedToPlain(decodeBorshExact(schema, 'Tree', tree)), { children: [{ children: [] }, { children: [] }] });

		let deep: Buffer = leaf;
		for (let level = 0; level < 100; level++) {
			deep = Buffer.concat([encode.u32(1), deep]);
		}
		assert.throws(() => decodeBorshExact(schema, 'Tree', deep), /nest deeper/);
	});
});

describe('borsh addresses', () => {
	test('ECDSA keys fill all 34 bytes', () => {
		for (const keyType of [AccountKeyAlgorithm.ECDSA_SECP256K1, AccountKeyAlgorithm.ECDSA_SECP256R1]) {
			const account = testAccount(keyType);
			const bytes = encodeAddress(account);
			assert.equal(bytes.length, 34);
			assert.equal(bytes[0], keyType);
			assert.deepEqual(decodeBorshExact(schema, 'Address', bytes), { kind: 'address', value: account });
		}
	});

	test('other keys are 33 bytes then a zero', () => {
		for (const keyType of [AccountKeyAlgorithm.ED25519, AccountKeyAlgorithm.STORAGE, AccountKeyAlgorithm.TOKEN]) {
			const account = testAccount(keyType);
			const bytes = encodeAddress(account);
			assert.equal(bytes[0], keyType);
			assert.equal(bytes[33], 0);
			assert.equal(decodeAddress(bytes), account);

			const padded = Buffer.from(bytes);
			padded[33] = 1;
			assert.throws(() => decodeBorshExact(schema, 'Address', padded), /ends in a zero byte/);
		}
	});

	test('an unknown key type is refused', () => {
		const bytes = Buffer.alloc(34);
		bytes[0] = 200;
		assert.throws(() => decodeBorshExact(schema, 'Address', bytes), BorshDecodeError);
	});

	test('addresses in a value are found', () => {
		const config = decodeBorshExact(petInterface.types as BorshSchema, 'Config', hex(petConfigAccount.data));
		assert.deepEqual(addressesIn(config), [petConfigAccount.admin, petConfigAccount.foodToken]);
	});
});

describe('borsh errors', () => {
	test('truncated data', () => {
		assert.throws(() => decodeBorshExact(schema, 'u64', hex('0102')), /Expected 8 bytes for u64, but only 2 remain/);
		assert.throws(() => decodeBorshExact(schema, 'String', Buffer.concat([encode.u32(5), hex('6162')])), BorshDecodeError);
	});

	test('bytes left over', () => {
		assert.deepEqual(decodeBorsh(schema, 'u8', hex('0102')), { value: { kind: 'integer', type: 'u8', value: '1' }, length: 1 });
		assert.throws(() => decodeBorshExact(schema, 'u8', hex('0102')), /1 bytes left over/);
		assert.equal(tryDecodeBorshExact(schema, 'u8', hex('0102')), null);
	});

	test('unknown types', () => {
		assert.throws(() => decodeBorshExact(schema, 'Bogus', hex('')), /Unknown type "NotAType"/);
		assert.throws(() => decodeBorshExact(schema, 'Nope', hex('')), /Unknown type "Nope"/);
	});

	test('names of Object.prototype are not types', () => {
		const bogus: BorshSchema = { S: { kind: 'struct', fields: ['toString', 'u8'] } };
		assert.throws(() => decodeBorshExact(bogus, 'S', hex('01')), /Unknown type "toString"/);
		assert.equal(tryDecodeBorshExact({ V: { kind: 'sequence', elements: 'constructor' } }, 'V', hex('0100000005')), null);
	});
});

describe('borsh decoding is bounded', () => {
	/* T0 holds two T1s, each two T2s, ...: 2^depth values that take no bytes */
	function doubling(depth: number, leaf: string): BorshSchema {
		const types: BorshSchema = {};
		for (let index = 0; index < depth; index++) {
			types[`T${index}`] = { kind: 'struct', fields: [`T${index + 1}`, `T${index + 1}`] };
		}
		types[`T${depth}`] = { kind: 'primitive', size: leaf === '()' ? 0 : 1 };
		return(types);
	}

	test('types that take no bytes cannot nest into too many values', () => {
		assert.throws(() => decodeBorshExact(doubling(60, '()'), 'T0', hex('')), /More than 100000 values/);
		const nested: BorshSchema = {
			Outer: { kind: 'sequence', elements: 'Inner', length: 65_536 },
			Inner: { kind: 'sequence', elements: '()', length: 65_536 }
		};
		assert.throws(() => decodeBorshExact(nested, 'Outer', hex('')), /More than 100000 values/);
	});

	test('the size of a sequence\'s elements is found once per type', () => {
		const types = { ...doubling(60, 'u8'), 'Vec<T0>': { kind: 'sequence', elements: 'T0' } } as BorshSchema;
		assert.throws(() => decodeBorshExact(types, 'Vec<T0>', encode.u32(1)), /more than the 0 bytes left can hold/);
		const recursive: BorshSchema = { Node: { kind: 'struct', fields: ['Node', 'Node', 'u8'] }, 'Vec<Node>': { kind: 'sequence', elements: 'Node' } };
		assert.deepEqual(decodeBorshExact(recursive, 'Vec<Node>', encode.u32(0)), { kind: 'sequence', type: 'Vec<Node>', elements: [] });
	});
});

describe('the pet contract\'s state', () => {
	const types = petInterface.types as BorshSchema;

	test('its config', () => {
		assert.deepEqual(decodedToPlain(decodeBorshExact(types, 'Config', hex(petConfigAccount.data))), {
			admin: petConfigAccount.admin,
			food_token: petConfigAccount.foodToken,
			food_price: petConfigAccount.foodPrice
		});
	});

	test('a pet', () => {
		const pet = decodedToPlain(decodeBorshExact(types, 'Pet', hex(petAccount.data)));
		assert.deepEqual(pet, {
			owner: petAccount.owner,
			name: petAccount.name,
			born: '1794245042',
			updated: '1794245042',
			fullness: '70000',
			happiness: '100000',
			meals: '1',
			plays: '2'
		});
	});

	test('neither decodes as the other', () => {
		assert.equal(tryDecodeBorshExact(types, 'Pet', hex(petConfigAccount.data)), null);
		assert.equal(tryDecodeBorshExact(types, 'Config', hex(petAccount.data)), null);
	});
});
