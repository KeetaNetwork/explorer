import { AssertionError } from 'assert';

type AssertFn<T> = (value: unknown) => asserts value is T;

/**
 * @summary This function takes an input of type unknown returns if it is a type.
 */
export function isType<T>(value: unknown, assert: AssertFn<T>): value is T {
	try {
		assert(value);
		return(true);
	} catch {
		return(false);
	}
}

/**
 * @summary This function takes an input of type unknown returns the type.
 */
export function asType<T>(value: unknown, assert: AssertFn<T>): T {
	assert(value);
	return(value);
}

/**
 * @summary This function asserts that the input condition is valid.
 */
export function assertCondition(
	condition: unknown,
	message?: string,
	operator?: string,
	actual?: unknown,
	expected?: unknown
): asserts condition {
	if (condition === false) {
		throw(new AssertionError({ message, operator, actual, expected }));
	}
}

/**
 * Helpers for conditions.
 */
export function isDefined<T>(value: unknown): value is NonNullable<T> {
	if (value === undefined || value === null) {
		return(false);
	}
	return(true);
}

export function isArray(value: unknown): value is unknown[] {
	return(Array.isArray(value));
}

export function isBoolean(value: unknown): value is boolean {
	return(typeof value === 'boolean');
}

export function isDate(value: unknown): value is Date {
	return(value instanceof Date);
}

export function isString(value: unknown): value is string {
	return(typeof value === 'string');
}

export function isNumber(value: unknown): value is number {
	return(typeof value === 'number');
}

export function isObject(value: unknown): value is object {
	return(typeof value === 'object');
}

export function hasProperty<T extends object, P extends string>(obj: T, value: P): obj is T & { [K in P]: unknown } {
	return(value in obj);
}

export function hasDefinedProperty<T extends object, P extends string>(
	obj: T,
	value: P
): obj is T & { [K in P]: NonNullable<unknown> } {
	// @ts-ignore
	return(hasProperty(obj, value) && isDefined(obj[value]));
}

type MappedTypes = {
	array: unknown[];
	date: Date;
	string: string;
	boolean: boolean;
	number: number;
	object: object;
};
export function hasDefinedPropertyType<T extends object, P extends string, Type extends keyof MappedTypes>(
	obj: T,
	value: P,
	type: Type
): obj is T & { [K in P]: MappedTypes[Type] } {
	let typeCheckFn;
	if (type === 'boolean') {
		typeCheckFn = isBoolean;
	} else if (type === 'string') {
		typeCheckFn = isString;
	} else if (type === 'date') {
		typeCheckFn = isDate;
	} else if (type === 'number') {
		typeCheckFn = isNumber;
	} else if (type === 'array') {
		typeCheckFn = isArray;
	} else if (type === 'object') {
		typeCheckFn = isObject;
	} else {
		throw(new Error('Type not implemented'));
	}
	// @ts-ignore
	return(hasProperty(obj, value) && isDefined(obj[value]) && typeCheckFn(obj[value]));
}

/**
 * @summary Assert data is defined. It's only to fix the type for typescript.
 * @description When we use react-query with `suspense = true`, the query is
 * loaded before render the component, so `status` are not used and `data`
 * is always defined, so this assert is only to fix the type for typescript.
 */
export function assertIsDefined<T>(data?: unknown, message?: string): asserts data is NonNullable<T> {
	assertCondition(isDefined(data), message);
}
