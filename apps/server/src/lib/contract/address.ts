/**
 * Keeta accounts as contracts see them: an `Address` is 34 bytes, the
 * account's key type then its public key, zero-padded. ECDSA keys
 * (secp256k1 and P-256, 33 bytes compressed) fill it; the others (32
 * bytes) leave one zero byte at the end.
 */
import { KeetaNetLib } from '@/utils/keetanet';

export const ADDRESS_LENGTH = 34;

type GenericAccount = ReturnType<typeof KeetaNetLib.lib.Account.fromPublicKeyString>;

/** Key types whose public keys are 33 bytes */
const LONG_KEY_TYPES = new Set([
	KeetaNetLib.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256K1,
	KeetaNetLib.lib.Account.AccountKeyAlgorithm.ECDSA_SECP256R1
]);

/**
 * The keeta_ address of a 34-byte contract `Address`
 */
export function decodeAddress(bytes: Uint8Array): string {
	if (bytes.length !== ADDRESS_LENGTH) {
		throw(new Error(`An address is ${ADDRESS_LENGTH} bytes, not ${bytes.length}`));
	}

	const keyType = bytes[0];
	let used = ADDRESS_LENGTH;
	if (!LONG_KEY_TYPES.has(keyType)) {
		used = ADDRESS_LENGTH - 1;
		if (bytes[ADDRESS_LENGTH - 1] !== 0) {
			throw(new Error(`An address of key type ${keyType} ends in a zero byte`));
		}
	}

	let account: GenericAccount;
	try {
		account = KeetaNetLib.lib.Account.fromPublicKeyAndType(Buffer.from(bytes.subarray(0, used)));
	} catch {
		throw(new Error(`Not a valid address of key type ${keyType}`));
	}

	return(account.publicKeyString.get());
}

/**
 * The 34-byte contract `Address` of an account
 */
export function encodeAddress(account: GenericAccount | string): Buffer {
	const resolved = typeof account === 'string' ? KeetaNetLib.lib.Account.fromPublicKeyString(account) : account;
	const keyAndType = resolved.publicKeyAndType;
	if (keyAndType.length > ADDRESS_LENGTH) {
		throw(new Error(`Account ${resolved.publicKeyString.get()} does not fit an address`));
	}

	const encoded = Buffer.alloc(ADDRESS_LENGTH);
	keyAndType.copy(encoded);
	return(encoded);
}
