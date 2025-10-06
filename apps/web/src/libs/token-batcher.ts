import type * as Anchor from "@keetanetwork/anchor";
import type { GenericAccount } from "@keetanetwork/web-ui/helpers/keetanet-operations";
import { Numeric } from "@keetanetwork/web-ui/helpers/Numeric";

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

type Client = InstanceType<typeof Anchor.KeetaNet.Client>;

type AccountInfo = Awaited<ReturnType<Client["getAccountsInfo"]>>[number]

interface WaiterPromise {
	resolve(token: TokenDetails): void
	reject(error: unknown): void
}


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
				decimalPlaces: Number(parsedMetadata.decimalPlaces ?? 0)
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

export class TokenBatcher {
	#client: Client
	#baseToken: GenericAccount

	#queue = new Set<string>()
	#waiters = new Map<string, WaiterPromise[]>()
	#timer: NodeJS.Timeout | null = null

	#waitInMs = 25
	#maxKeys = 25

	constructor(client: Client, baseToken: GenericAccount) {
		this.#client = client
		this.#baseToken = baseToken
	}

	get(publicKey: string): Promise<TokenDetails> {
		return new Promise((resolve, reject) => {
			// Collect waiters per key
			const arr = this.#waiters.get(publicKey) ?? []
			arr.push({ resolve, reject })
			this.#waiters.set(publicKey, arr)

			this.#queue.add(publicKey)

			// Burst guard
			if (this.#queue.size >= this.#maxKeys) {
				this.flushNow()
				return
			}

			this.#schedule()
		})
	}

	flushNow() {
		if (this.#timer) {
			clearTimeout(this.#timer)
			this.#timer = null
		}
		this.#flush()
	}

	#schedule() {
		if (this.#timer) return

		this.#timer = setTimeout(() => {
			this.#timer = null
			this.#flush()
		}, this.#waitInMs)
	}

	async #flush() {
		if (!this.#queue.size) return

		const keys = Array.from(this.#queue)
		this.#queue.clear()

		const waiters = this.#waiters
		this.#waiters = new Map()

		try {
			const tokens = await this.#client.getAccountsInfo(keys)

			for (const key of keys) {
				const token = tokens?.[key]
				const waiter = waiters.get(key) ?? []
				if (token) {
					waiter.forEach(w => w.resolve(parseTokenDetails(token, this.#baseToken)))
				} else {
					waiter.forEach(w => w.reject(new Error(`Token not found: ${key}`)))
				}
			}
		} catch (err) {
			for (const key of keys) {
				const waiter = waiters.get(key)
				if (waiter) {
					waiter.forEach(w => w.reject(err))
				}
			}
		}
	}
}
