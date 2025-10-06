import crypto from 'node:crypto';

/**
 * Number of iterations for PBKDF2 -- this should change over time to
 * keep up with the OWASP recommendation
 */
const PBKDF2_ITERATION_COUNT = 600000;

/**
 * Default key length for PBKDF2 -- this should generally not change
 */
const PBKDF2_KEY_LEN = 32;

/**
 * Default digest for PBKDF2 -- this should generally not change
 */
const PBKDF2_DIGEST = 'sha3-256';

/**
 * @summary Hashes the input data using PBKDF2
 * @returns The hashed representation of the data
 */
export function pbkdf2Sync(
	inputBuffer: Buffer,
	saltBuffer: Buffer,
	iterations: number = PBKDF2_ITERATION_COUNT,
	keylen: number = PBKDF2_KEY_LEN,
	digest: string = PBKDF2_DIGEST
) {
	return(crypto.pbkdf2Sync(
		inputBuffer,
		saltBuffer,
		iterations,
		keylen,
		digest
	));
}

/**
 * @summary Hashes the input data using PBKDF2 asynchronously -- this uses the LibUV thread pool
 * @returns The hashed representation of the data
 */
export async function pbkdf2(
	inputBuffer: Buffer,
	saltBuffer: Buffer,
	iterations: number = PBKDF2_ITERATION_COUNT,
	keylen: number = PBKDF2_KEY_LEN,
	digest: string = PBKDF2_DIGEST
): Promise<ReturnType<typeof pbkdf2Sync>> {
	return(await new Promise<Buffer>(function(resolve, reject) {
		crypto.pbkdf2(
			inputBuffer,
			saltBuffer,
			iterations,
			keylen,
			digest,
			/*
			 * Callback function for async PBKDF2
			 */
			function(error, derivedKey) {
				if (error !== null) {
					reject(error);
				} else {
					resolve(derivedKey);
				}
			}
		);
	}));
}
