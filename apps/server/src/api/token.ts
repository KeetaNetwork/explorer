import { KeetaNetLib } from "@/utils/keetanet";
import type { WorkerEnv } from "@/lib/explorer/worker";
import { isValidPublicKey } from "@/utils/network";
import { jsonResponse } from "@/utils/response";
import { Hono } from "hono";
import { NotFoundError } from "./errors";
import { validator } from "hono/validator";
import * as v from "valibot";
import { splitEvenly } from "@/utils/array";
import { Numeric } from "@keetanetwork/web-ui-utils/helpers/Numeric";
import type { GenericAccount } from "@keetanetwork/web-ui-utils/helpers/keetanet-operations";

/**
 * Types
 */
export type TokenDetails = {
	name: string;
	currencyCode: string;
	decimalPlaces: number;
	publicKey: string;
	supply: Numeric;
	headBlock: string | null;
	accessMode: "PUBLIC" | "PRIVATE";
	defaultPermissions: string[]
	type: "BASE" | "TRUSTABLE" | "RISKY" | "UNKNOWN";
};

type AccountInfo = Awaited<ReturnType<typeof KeetaNetLib.UserClient.prototype.client.getAccountsInfo>>[number];

/**
 * Schema to validate query parameters for /token endpoint
 */
const tokenQuerySchema = v.object({
	publicKey: v.pipe(
		// Accept either a single string or an array of strings
		v.union([v.string(), v.array(v.string())]),
		// Transform to array, De-duplicate, trim and remove empty strings
		v.transform(v => ([...new Set(Array.isArray(v) ? v : [v])]).map(s => s.trim()).filter(s => s.length > 0)),
		// Validate each item in the array is a valid public key 
		v.check(v => v.every(s => isValidPublicKey(s)), "All items must be valid public keys"),
		// Ensure at least one public key is provided
		v.minLength(1, "At least one public key must be provided")
	),
});

/**
 * Parsers
 */
function parseTokenMetadata(metadata: string | undefined): { decimalPlaces: number } {
	if (!metadata) {
		return({ decimalPlaces: 0 });
	}

	try {
		const parsedMetadata: unknown = JSON.parse(atob(metadata));
		if (
			parsedMetadata &&
			typeof parsedMetadata === 'object' &&
			'decimalPlaces' in parsedMetadata
		) {
			return({
				decimalPlaces: Number(parsedMetadata.decimalPlaces)
			});
		}
	} catch {  /* Ignore  */ }

	return({ decimalPlaces: 0 });
}

 export function parseTokenDetails(token: AccountInfo, baseToken: GenericAccount): TokenDetails {
	const metadata = parseTokenMetadata(token.info.metadata);

	return({
		headBlock: token.currentHeadBlock,
		currencyCode: token.info.name,
		name: token.info.description,
		publicKey: token.account.publicKeyString.toString(),
		supply: new Numeric(token.info.supply ?? 0),
		accessMode: token.info.defaultPermission?.has(['ACCESS']) ? "PUBLIC" : "PRIVATE",
		defaultPermissions: token.info.defaultPermission?.base.flags ?? [],
		type: baseToken.comparePublicKey(token.account) ? "BASE" : "UNKNOWN",
		...metadata
	});
}

/**
 * Helpers
 */
export async function getManyTokens(client: InstanceType<typeof KeetaNetLib.Client>, publicKeys: string[], baseToken: GenericAccount) {
	if (publicKeys.length === 0) {
		return {};
	}

	/**
	 * Load account infos in batches, retrying with smaller batches if necessary
	 * to avoid exceeding URL length limits.
	 */
	let infos: Awaited<ReturnType<InstanceType<typeof KeetaNetLib.Client>['getAccountsInfo']>> = {};
	let attempts = 1;
	while (Object.keys(infos).length === 0) {
		// Try to keep each request under 8KiB
		try {
			const listsSize = Math.max(1, Math.floor(200 / attempts));
			const batches = splitEvenly(publicKeys, listsSize);
			const loadedInfos = await Promise.all(batches.map(async (batch) => {
				return(await client.getAccountsInfo(batch));
			}));
			infos = Object.assign({}, ...loadedInfos.flat());
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes('URL Must not be over 8KiB')) {
				attempts++;
				if (attempts >= 20) {
					throw new Error('Too many retries loading tokens');
				}
			} else {
				throw error;
			}
		}
	}

	// Filter for token accounts only
	const filteredInfos = Object.entries(infos).filter(([, data]) => data && data.account.isToken())

	// Parse details for each token account
	return Object.fromEntries(filteredInfos.map(([key, data]) => ([key, parseTokenDetails(data, baseToken)])))
}


/**
 * Endpoints
 */
const token = new Hono<WorkerEnv>()
	/**
	 * Get token details by list of public keys, used for bulk loading
	 */
	.get('/', validator("query", q => v.parse(tokenQuerySchema, q)), async (c) => {
		const client = c.get('explorer').keetaNet.network.client;
		const { publicKey: publicKeys } = c.req.valid("query");
		
		const tokens = await getManyTokens(client, publicKeys, c.get('explorer').keetaNet.network.getBaseToken());
		return jsonResponse(c, { tokens })
	})

	/**
	 * Get token
	 */
	.get('/:tokenPublicKey', async (c) => {
		const client = c.get('explorer').keetaNet.network.client;
		const { tokenPublicKey } = c.req.param()

		if (!isValidPublicKey(tokenPublicKey)) {
			throw new NotFoundError('Invalid public key');
		}

		const info = await client.getAccountInfo(tokenPublicKey);
		const token = parseTokenDetails(info, c.get('explorer').keetaNet.network.getBaseToken());

		return jsonResponse(c, { token })
	})

export default token