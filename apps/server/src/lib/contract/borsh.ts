/**
 * A decoder for borsh-encoded data described by a schema, as found in a
 * contract's interface (`keeta-contract-interface`): every type by name,
 * each one a primitive, an address, a struct, an enum, a sequence or a
 * tuple.
 *
 * Decoding never trusts the data: lengths are checked against what is left,
 * nesting is bounded, and anything that does not fit the schema throws a
 * {@link BorshDecodeError}.
 */
import { decodeAddress, ADDRESS_LENGTH } from './address';

/**
 * Schema
 */
export type BorshStructField = string | { name: string, type: string };

export type BorshTypeDefinition =
	| { kind: 'primitive', size: number }
	| { kind: 'address' }
	| { kind: 'struct', fields: BorshStructField[] }
	| { kind: 'enum', tagWidth?: number, variants: { discriminant: number, name: string, type?: string | null }[] }
	| { kind: 'sequence', elements: string, length?: number, lengthWidth?: number }
	| { kind: 'tuple', elements: string[] };

export type BorshSchema = { [typeName: string]: BorshTypeDefinition };

/**
 * Decoded values: the shape of the data, with each value's type name, so
 * it can be shown as the contract's author wrote it
 */
export type DecodedField = { name: string | null, value: DecodedValue };

export type DecodedValue =
	| { kind: 'integer', type: string, value: string }
	| { kind: 'float', type: string, value: number }
	| { kind: 'bool', value: boolean }
	| { kind: 'unit' }
	| { kind: 'address', value: string }
	| { kind: 'string', value: string }
	| { kind: 'bytes', type: string, hex: string }
	| { kind: 'struct', type: string, fields: DecodedField[] }
	| { kind: 'enum', type: string, variant: string, discriminant: number, fields: DecodedField[] }
	| { kind: 'sequence', type: string, elements: DecodedValue[] }
	| { kind: 'tuple', type: string, elements: DecodedValue[] };

export class BorshDecodeError extends Error {
	readonly offset: number;

	constructor(message: string, offset: number) {
		super(`${message} (at byte ${offset})`);
		this.name = 'BorshDecodeError';
		this.offset = offset;
	}
}

/** Deepest nesting of types decoded */
const MAX_DEPTH = 64;

/** Most elements of a sequence whose elements take no bytes */
const MAX_EMPTY_ELEMENTS = 65_536;

/**
 * Most values decoded from one input: types that take no bytes (or few)
 * can otherwise nest into more values than any data holds
 */
const MAX_DECODED_VALUES = 100_000;

/**
 * Primitives borsh knows by name, for schemas that use one without listing it
 */
const BUILTIN_PRIMITIVES: { [name: string]: number } = {
	u8: 1, u16: 2, u32: 4, u64: 8, u128: 16,
	i8: 1, i16: 2, i32: 4, i64: 8, i128: 16,
	f32: 4, f64: 8,
	bool: 1,
	'()': 0
};

function resolveType(schema: BorshSchema, typeName: string, offset: number): BorshTypeDefinition {
	if (Object.prototype.hasOwnProperty.call(schema, typeName)) {
		return(schema[typeName]);
	}

	if (Object.prototype.hasOwnProperty.call(BUILTIN_PRIMITIVES, typeName)) {
		return({ kind: 'primitive', size: BUILTIN_PRIMITIVES[typeName] });
	}

	if (typeName === 'Address') {
		return({ kind: 'address' });
	}

	throw(new BorshDecodeError(`Unknown type "${typeName}"`, offset));
}

function readUnsigned(data: Uint8Array, offset: number, size: number): bigint {
	let value = 0n;
	for (let index = size - 1; index >= 0; index--) {
		value = (value << 8n) | BigInt(data[offset + index]);
	}
	return(value);
}

function toHex(data: Uint8Array): string {
	return(Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString('hex'));
}

/**
 * The smallest number of bytes a value of a type takes, used to reject
 * sequence lengths the data cannot hold before decoding them
 */
function minimumSize(schema: BorshSchema, typeName: string, sizes: Map<string, number>, depth = 0): number {
	if (depth > MAX_DEPTH) {
		return(0);
	}

	/*
	 * Each type's size once: types used many times (or by themselves) would
	 * otherwise be walked once per use. A type is taken as 0 while its own
	 * size is found, which keeps this a lower bound.
	 */
	const known = sizes.get(typeName);
	if (known !== undefined) {
		return(known);
	}
	sizes.set(typeName, 0);
	const size = definitionMinimumSize(schema, typeName, sizes, depth);
	sizes.set(typeName, size);
	return(size);
}

function definitionMinimumSize(schema: BorshSchema, typeName: string, sizes: Map<string, number>, depth: number): number {
	let definition;
	try {
		definition = resolveType(schema, typeName, 0);
	} catch {
		return(0);
	}

	switch (definition.kind) {
		case 'primitive':
			return(definition.size);
		case 'address':
			return(ADDRESS_LENGTH);
		case 'struct':
			return(definition.fields.reduce((sum, field) => sum + minimumSize(schema, typeof field === 'string' ? field : field.type, sizes, depth + 1), 0));
		case 'tuple':
			return(definition.elements.reduce((sum, element) => sum + minimumSize(schema, element, sizes, depth + 1), 0));
		case 'enum':
			return(definition.tagWidth ?? 1);
		case 'sequence':
			if (definition.length !== undefined) {
				return(definition.length * minimumSize(schema, definition.elements, sizes, depth + 1));
			}
			return(definition.lengthWidth ?? 4);
	}
}

class Reader {
	offset = 0;

	/** Values decoded so far, at most {@link MAX_DECODED_VALUES} */
	values = 0;

	readonly sizes = new Map<string, number>();

	constructor(readonly schema: BorshSchema, readonly data: Uint8Array) {}

	get remaining(): number {
		return(this.data.length - this.offset);
	}

	take(size: number, what: string): Uint8Array {
		if (size > this.remaining) {
			throw(new BorshDecodeError(`Expected ${size} bytes for ${what}, but only ${this.remaining} remain`, this.offset));
		}
		const bytes = this.data.subarray(this.offset, this.offset + size);
		this.offset += size;
		return(bytes);
	}

	readUnsigned(size: number, what: string): bigint {
		const start = this.offset;
		this.take(size, what);
		return(readUnsigned(this.data, start, size));
	}

	decode(typeName: string, depth: number): DecodedValue {
		if (depth > MAX_DEPTH) {
			throw(new BorshDecodeError(`Types nest deeper than ${MAX_DEPTH}`, this.offset));
		}
		if (++this.values > MAX_DECODED_VALUES) {
			throw(new BorshDecodeError(`More than ${MAX_DECODED_VALUES} values`, this.offset));
		}

		const definition = resolveType(this.schema, typeName, this.offset);
		switch (definition.kind) {
			case 'primitive':
				return(this.decodePrimitive(typeName, definition.size));
			case 'address':
				return(this.decodeAddress(typeName));
			case 'struct':
				return({ kind: 'struct', type: typeName, fields: this.decodeFields(definition.fields, depth) });
			case 'tuple':
				return({ kind: 'tuple', type: typeName, elements: definition.elements.map(element => this.decode(element, depth + 1)) });
			case 'enum':
				return(this.decodeEnum(typeName, definition, depth));
			case 'sequence':
				return(this.decodeSequence(typeName, definition, depth));
			default:
				throw(new BorshDecodeError(`Type "${typeName}" has an unknown kind`, this.offset));
		}
	}

	decodePrimitive(typeName: string, size: number): DecodedValue {
		const start = this.offset;

		if (typeName === '()' || size === 0) {
			return({ kind: 'unit' });
		}

		if (typeName === 'bool') {
			const value = this.readUnsigned(1, typeName);
			if (value > 1n) {
				throw(new BorshDecodeError(`Invalid bool ${value}`, start));
			}
			return({ kind: 'bool', value: value === 1n });
		}

		if (typeName === 'f32' || typeName === 'f64') {
			const bytes = this.take(size, typeName);
			const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
			const value = size === 4 ? view.getFloat32(0, true) : view.getFloat64(0, true);
			return({ kind: 'float', type: typeName, value });
		}

		const integer = /^([ui])(8|16|32|64|128)$/.exec(typeName);
		if (integer) {
			const bits = Number(integer[2]);
			if (bits / 8 !== size) {
				throw(new BorshDecodeError(`Type "${typeName}" has size ${size}`, start));
			}
			let value = this.readUnsigned(size, typeName);
			if (integer[1] === 'i' && (value >> BigInt(bits - 1)) === 1n) {
				value -= 1n << BigInt(bits);
			}
			return({ kind: 'integer', type: typeName, value: value.toString() });
		}

		/*
		 * A primitive borsh does not name: keep its bytes
		 */
		return({ kind: 'bytes', type: typeName, hex: toHex(this.take(size, typeName)) });
	}

	decodeAddress(typeName: string): DecodedValue {
		const start = this.offset;
		const bytes = this.take(ADDRESS_LENGTH, typeName);
		try {
			return({ kind: 'address', value: decodeAddress(bytes) });
		} catch (error) {
			throw(new BorshDecodeError(error instanceof Error ? error.message : 'Invalid address', start));
		}
	}

	decodeFields(fields: BorshStructField[], depth: number): DecodedField[] {
		return(fields.map(field => {
			if (typeof field === 'string') {
				return({ name: null, value: this.decode(field, depth + 1) });
			}
			return({ name: field.name, value: this.decode(field.type, depth + 1) });
		}));
	}

	decodeEnum(typeName: string, definition: Extract<BorshTypeDefinition, { kind: 'enum' }>, depth: number): DecodedValue {
		const start = this.offset;
		const tagWidth = definition.tagWidth ?? 1;
		const discriminant = Number(this.readUnsigned(tagWidth, `the tag of ${typeName}`));
		const variant = definition.variants.find(candidate => candidate.discriminant === discriminant);
		if (!variant) {
			throw(new BorshDecodeError(`No variant of ${typeName} has discriminant ${discriminant}`, start));
		}

		let fields: DecodedField[] = [];
		if (variant.type) {
			/*
			 * A variant's type names a struct holding its fields; show those
			 * as the variant's own
			 */
			const variantDefinition = resolveType(this.schema, variant.type, this.offset);
			if (variantDefinition.kind === 'struct') {
				fields = this.decodeFields(variantDefinition.fields, depth + 1);
			} else {
				fields = [{ name: null, value: this.decode(variant.type, depth + 1) }];
			}
		}

		return({ kind: 'enum', type: typeName, variant: variant.name, discriminant, fields });
	}

	decodeSequence(typeName: string, definition: Extract<BorshTypeDefinition, { kind: 'sequence' }>, depth: number): DecodedValue {
		const start = this.offset;

		let length: number;
		if (definition.length !== undefined) {
			length = definition.length;
		} else {
			const lengthWidth = definition.lengthWidth ?? 4;
			const encodedLength = this.readUnsigned(lengthWidth, `the length of ${typeName}`);
			if (encodedLength > BigInt(Number.MAX_SAFE_INTEGER)) {
				throw(new BorshDecodeError(`Length ${encodedLength} of ${typeName} is too large`, start));
			}
			length = Number(encodedLength);
		}

		const elementSize = minimumSize(this.schema, definition.elements, this.sizes);
		if (elementSize > 0 && length * elementSize > this.remaining) {
			throw(new BorshDecodeError(`${typeName} has ${length} elements, more than the ${this.remaining} bytes left can hold`, start));
		}
		if (elementSize === 0 && length > MAX_EMPTY_ELEMENTS) {
			throw(new BorshDecodeError(`${typeName} has ${length} empty elements`, start));
		}

		/*
		 * Byte sequences: text for String, hex otherwise
		 */
		if (definition.elements === 'u8') {
			const bytes = this.take(length, typeName);
			if (typeName === 'String') {
				try {
					return({ kind: 'string', value: new TextDecoder('utf-8', { fatal: true }).decode(bytes) });
				} catch {
					throw(new BorshDecodeError(`${typeName} is not valid UTF-8`, start));
				}
			}
			return({ kind: 'bytes', type: typeName, hex: toHex(bytes) });
		}

		const elements: DecodedValue[] = [];
		for (let index = 0; index < length; index++) {
			elements.push(this.decode(definition.elements, depth + 1));
		}
		return({ kind: 'sequence', type: typeName, elements });
	}
}

/**
 * Decode a value of `typeName` from the start of `data`, returning it and
 * the number of bytes it took
 */
export function decodeBorsh(schema: BorshSchema, typeName: string, data: Uint8Array): { value: DecodedValue, length: number } {
	const reader = new Reader(schema, data);
	const value = reader.decode(typeName, 0);
	return({ value, length: reader.offset });
}

/**
 * Decode a value of `typeName` that takes all of `data`, or throw
 */
export function decodeBorshExact(schema: BorshSchema, typeName: string, data: Uint8Array): DecodedValue {
	const { value, length } = decodeBorsh(schema, typeName, data);
	if (length !== data.length) {
		throw(new BorshDecodeError(`${data.length - length} bytes left over after ${typeName}`, length));
	}
	return(value);
}

/**
 * Like {@link decodeBorshExact}, returning `null` instead of throwing
 */
export function tryDecodeBorshExact(schema: BorshSchema, typeName: string, data: Uint8Array): DecodedValue | null {
	try {
		return(decodeBorshExact(schema, typeName, data));
	} catch (error) {
		if (error instanceof BorshDecodeError) {
			return(null);
		}
		throw(error);
	}
}

type PlainValue = string | number | boolean | null | PlainValue[] | { [key: string]: PlainValue };

function fieldsToPlain(fields: DecodedField[]): PlainValue {
	if (fields.every(field => field.name !== null)) {
		return(Object.fromEntries(fields.map(field => [field.name, decodedToPlain(field.value)])));
	}
	if (fields.length === 1) {
		return(decodedToPlain(fields[0].value));
	}
	return(fields.map(field => decodedToPlain(field.value)));
}

/**
 * A decoded value as plain JSON: structs as objects (arrays for tuple
 * structs), unit enum variants as their name and others as `{ Variant:
 * fields }`, 64-bit and larger integers as strings, bytes as hex
 */
export function decodedToPlain(value: DecodedValue): PlainValue {
	switch (value.kind) {
		case 'integer': {
			const asNumber = Number(value.value);
			return(Number.isSafeInteger(asNumber) && !/64|128/.test(value.type) ? asNumber : value.value);
		}
		case 'float':
		case 'bool':
		case 'address':
		case 'string':
			return(value.value);
		case 'unit':
			return(null);
		case 'bytes':
			return(`0x${value.hex}`);
		case 'struct':
			return(fieldsToPlain(value.fields));
		case 'enum':
			if (value.fields.length === 0) {
				return(value.variant);
			}
			return({ [value.variant]: fieldsToPlain(value.fields) });
		case 'sequence':
		case 'tuple':
			return(value.elements.map(decodedToPlain));
	}
}

/**
 * Every address in a decoded value, in order of appearance
 */
export function addressesIn(value: DecodedValue, found: string[] = []): string[] {
	switch (value.kind) {
		case 'address':
			found.push(value.value);
			break;
		case 'struct':
		case 'enum':
			value.fields.forEach(field => addressesIn(field.value, found));
			break;
		case 'sequence':
		case 'tuple':
			value.elements.forEach(element => addressesIn(element, found));
			break;
	}
	return(found);
}
