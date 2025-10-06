import * as components from '@keetanetwork/pulumi-components';
import * as crypto from 'crypto';
import * as pulumi from '@pulumi/pulumi';

/**
 * Hash a string or array of strings
 */
export function HashStrings(input: string | (string | undefined)[], length?: number): string;
export function HashStrings(input: pulumi.Output<string | undefined>[], length?: number): pulumi.Output<string>;
export function HashStrings(input: string | (string | undefined)[] | pulumi.Output<string | undefined>[], length?: number): string | pulumi.Output<string> {
	if (Array.isArray(input)) {
		const firstInput = input[0];

		/**
		 * If the input is an array of pulumi.Output, then process the
		 * hashing after unwrapping
		 */
		if (pulumi.Output.isInstance(firstInput)) {
			const combinedInput = pulumi.all(input);
			return(combinedInput.apply(function(wrappedInput) {
				return(HashStrings(wrappedInput, length));
			}));
		}

		/**
		 * Otherwise, join the values
		 */
		input = input.join(' ');
	}

	const hash = crypto.createHash('sha1');
	hash.update(input);

	let digest = hash.digest('hex');

	if (length !== undefined) {
		digest = digest.slice(0, length);
	}

	return(digest);
}

/**
 * Check if a value is not null or undefined
 */
export function nonNullable<T>(value: T): value is NonNullable<T> {
	return(value !== null && value !== undefined);
}

/**
 * Get the first letter of a string
 */
export function getPrefixHash(data: string, length = 20, addPrefix: boolean | string = true) {
	const hash = crypto.createHash('sha1');

	hash.update(data);

	const digest = hash.digest('hex');

	let hashPrefix = '';
	if (addPrefix === true) {
		const letterMatches = digest.match(/[A-Za-z]/g);
		const firstChar = (letterMatches ?? ['a'])[0];

		hashPrefix = firstChar;
	} else if (typeof addPrefix === 'string') {
		hashPrefix = addPrefix;
	}

	const combined = `${hashPrefix}${digest}`;
	const sub = combined.substring(0, length);

	return(sub.toLowerCase());
}

/**
 * Create a resource name that fits within a defined length.
 * It will be constructed by hashing the prefix, then including as much of it
 * can as well as 6 characters of the hash, and the entire suffix
 */
export function generateName(prefix: string, suffix: string, maxLength: number) {
	prefix = components.utils.normalizeName(prefix);
	const prefixMaxLength = maxLength - suffix.length - 1;

	let realPrefix: string = prefix;
	if (realPrefix.length > prefixMaxLength) {
		realPrefix = realPrefix.slice(0, prefixMaxLength - 1 - 6) + getPrefixHash(realPrefix, 6, false);
	}

	return(`${realPrefix}-${suffix}`);
}
