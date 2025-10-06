import type { ApiRoute } from "@/api";
import type { hc } from "hono/client";

type Client = ReturnType<typeof hc<ApiRoute>>;
type GetTokenResponse = Awaited<ReturnType<Awaited<ReturnType<Client['token'][':tokenPublicKey']['$get']>>['json']>>;

type WaiterPromise = {
	resolve(token: GetTokenResponse): void;
	reject(error: unknown): void
};

export class TokenBatcher {
	#client: Client;
	
	#queue = new Set<string>();
	#waiters = new Map<string, WaiterPromise[]>();
	#timer: NodeJS.Timeout | null = null;

	#waitInMs = 25;
	#maxKeys = 50;

	constructor(client: Client) {
		this.#client = client;
	}

	get(publicKey: string): Promise<GetTokenResponse> {
		return new Promise((resolve, reject) => {
			// Collect waiters per key
			const arr = this.#waiters.get(publicKey) ?? [];
			arr.push({ resolve, reject });
			this.#waiters.set(publicKey, arr);

			this.#queue.add(publicKey);

			// Burst guard
			if (this.#queue.size >= this.#maxKeys) {
				this.flushNow();
				return;
			}

			this.#schedule();
		});
	}

	flushNow() {
		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
		this.#flush();
	}

	#schedule() {
		if (this.#timer) return;

		this.#timer = setTimeout(() => {
			this.#timer = null;
			this.#flush();
		}, this.#waitInMs);
	}

	async #flush() {
		if (!this.#queue.size) return;

		const keys = Array.from(this.#queue);
		this.#queue.clear();

		const waiters = this.#waiters;
		this.#waiters = new Map();

		try {
			const response = await this.#client.token.$get({ query: { publicKey: keys } });
			const { tokens } = await response.json()

			for (const key of keys) {
				const token = tokens?.[key];
				const waiter = waiters.get(key) ?? [];
				if (token) {
					waiter.forEach(w => w.resolve({ token }));
				} else {
					waiter.forEach(w => w.reject(new Error(`Token not found: ${key}`)));
				}
			}
		} catch (err) {
			for (const key of keys) {
				(waiters.get(key) ?? []).forEach(w => w.reject(err));
			}
		}
	}
}