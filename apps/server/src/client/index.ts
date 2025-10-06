import type { ApiRoute } from "@/api";
import { hc } from "hono/client";
import type { NetworkConfig } from "@/lib/network";
import { ClientHTTPError, ClientNotFoundError, ClientUnauthorizedError } from "./errors";
import { ExplorerSDKWebSocket } from "./websocket";
import { createHeaderFromNetworkConfig } from "@/utils/request";
import { CustomSuperJSON } from "@/utils/json";
import { TokenBatcher } from "./batcher";

const DEFAULT_REQUEST_TIMEOUT = 15_000; // 15 seconds

const DEFAULT_NETWORK_ALIAS = 'test';

/**
 * SDK Client Config
 */
export interface ExplorerSDKConfig {
	/**
	 * Base URL for the Keeta Explorer API
	 */
	baseURL?: string;

	/**
	 * Network alias for the client
	 */
	networkConfig?: NetworkConfig;

	/**
	 * Request timeout in milliseconds
	 */
	timeoutMs?: number;
}

interface PendingRequest {
  url: string;
  controller: AbortController;
  sentAt: number;
};

class FetchController extends AbortController {
	/**
	 * Timeout for the request
	 */
	_timeout: NodeJS.Timeout | null = null;

	constructor(timeoutMs?: number) {
		super();
		
		// If a timeout is specified, set up a timeout to abort the request
		if (typeof timeoutMs === 'number') {
			this._timeout = setTimeout(() => {
				this.abort(new DOMException('Request timed out', 'TimeoutError'));
			}, timeoutMs);
    	}
	}

	abort(reason?: string | DOMException): void {
		if (this._timeout) clearTimeout(this._timeout);
		super.abort(reason);
	}
}

export type { ApiRoute };

/**
 * Keeta Explorer SDK Client
 */
export class ExplorerSDK {
	client!: ReturnType<typeof hc<ApiRoute>>;

	config!: Required<ExplorerSDKConfig>;

	ws!: ExplorerSDKWebSocket;

	pendingRequests: Map<symbol, PendingRequest> = new Map();

	constructor(configs: ExplorerSDKConfig) {
		const {
			baseURL = 'https://explorer.test.keeta.com/',
			networkConfig = { networkAlias: DEFAULT_NETWORK_ALIAS },
			timeoutMs = DEFAULT_REQUEST_TIMEOUT
		} = configs;

		// Set the config
		this.#setConfig({ baseURL: ExplorerSDK.formatAPIUrl(baseURL), networkConfig, timeoutMs });
	}

	/**
	 * Set the config for the client
	 */
	#setConfig(config: Partial<ExplorerSDKConfig>) {
		this.config = {
			...this.config,
			...config
		};

		this.client = hc<ApiRoute>(this.config.baseURL!, {
			headers: (): Record<string, string> => {
				return createHeaderFromNetworkConfig(this.config.networkConfig);
			},
			fetch: async (input: URL, requestInit?: RequestInit) => {
				// Add the request to pending requests
				const id = Symbol('request-id');
				const controller = new FetchController(this.config.timeoutMs);
				this.pendingRequests.set(id, {
					url: input.toString(),
					controller,
					sentAt: Date.now()
				});

				// Execute the request with the controller's signal
				const response = await fetch(input, {
					...requestInit,
					signal: controller.signal,
				});

				// Remove the request from pending requests
				this.pendingRequests.delete(id);
				
				// Check if the response is ok and throw appropriate errors
				if (!response.ok) {
					if (response.status === 404) {
						throw new ClientNotFoundError(response.statusText);
					} else if (response.status === 401) {
						throw new ClientUnauthorizedError(response.statusText);
					} else {
						throw new ClientHTTPError(response.status, response.statusText);
					}
				}

				return new Proxy(response, {
					get(target, prop, receiver) {
						if (prop === 'json') {
							return async () => {
								const parsedJson = await target.clone().json();
								if (typeof parsedJson === 'object' && parsedJson !== null && 'json' in parsedJson && typeof parsedJson.json !== 'undefined') {
									const text = await target.clone().text();
									return CustomSuperJSON.parse(text);
								}
								return parsedJson;
							};
						}
						const value = Reflect.get(target, prop, receiver);
						return typeof value === 'function' ? value.bind(target) : value;
					}
				})
			},
		});

		this.ws = new ExplorerSDKWebSocket(this);
	}

	/**
	 * Update the network configuration.
	 */
	async updateNetworkConfig(networkConfig: NetworkConfig) {
		// Validate the network before changing the config
		try {
			await this.client.network.settings.$get({}, {
				headers: createHeaderFromNetworkConfig(networkConfig)
			});
		} catch {
			throw new Error(`Network ${networkConfig.networkAlias} is not valid or does not exist.`);
		}

		// Set the new config
		this.#setConfig({ networkConfig });
	}

	/**
	 * Format the API URL
	 */
	static formatAPIUrl(input: string): string {
		const urlObject = new URL(input);

		if (!(['http:', 'https:']).includes(urlObject.protocol)) {
			throw(new Error(`Invalid protocol specified in URL: ${urlObject.protocol}`));
		}

		if (urlObject.pathname === '/') {
			urlObject.pathname = '/api/v1/';
		}

		return(urlObject.toString());
	}

	/**
	 * FALLBACK
	 */
	get account() {
		return {
			details: async (accountPublicKey: string) => {
				const response = await this.client.account[":accountPublicKey"].$get({ param: { accountPublicKey }})
				return await response.json();
			},

			list: async () => {
				const response = await this.client.account.$get()
				return await response.json();
			},

			certificate: async (accountPublicKey: string, certificateHash: string) => {
				const response = await this.client.account[":accountPublicKey"].certificate[":certificateHash"].$get({
					param: { accountPublicKey, certificateHash }
				});
				return await response.json();
			}
		}
	}

	get storage() {
		return {
			details: async (accountPublicKey: string) => {
				const response = await this.client.storage[":accountPublicKey"].$get({ param: { accountPublicKey }})
				return await response.json();
			},
		}
	}
	
	get network() {
		return {
			stats: async () => {
				const response = await this.client.network.stats.$get()
				return await response.json();
			},

			getVoteStaple: async (blockhash: string) => {
				const response = await this.client.network.staple[":blockhash"].$get({ param: { blockhash }});
				return await response.json();
			},

			list: async () => {
				const response = await this.client.network.$get()
				return await response.json();
			},
		}
	}

	async transactions(query?: Parameters<typeof this.client.transaction.$get>[0]['query']) {
		const response = await this.client.transaction.$get({ query });
		return await response.json();
	}

	#tokenBatcher?: TokenBatcher;
	get tokens() {
		this.#tokenBatcher ??= new TokenBatcher(this.client);
		return {
			get: async (tokenPublicKey: string, flushNow?: boolean) => {
				const response = await this.#tokenBatcher!.get(tokenPublicKey);
				if (flushNow) {
					this.#tokenBatcher!.flushNow();
				}
				return response;
			}
		}
	}

	/**
	 * Get expired requests for a specific URL.
	 */
	getStaleRequestsForUrl(url: string, toleranceMs: number = 1000): [symbol, PendingRequest][] {
		const now = Date.now();
		const threshold = now - toleranceMs;
		return [ ...this.pendingRequests.entries() ].filter(
			([, req]) => req.url.startsWith(url) && req.sentAt < threshold
		);
	}

	abortStaleRequestsForUrl(url: string, toleranceMs?: number): void {
		const expiredRequests = this.getStaleRequestsForUrl(url, toleranceMs);
		expiredRequests.forEach(([id, req]) => {
			console.warn('Aborting expired request:', req.url);
			req.controller.abort('Request expired');
			this.pendingRequests.delete(id);
		});
	}

	abortAllPendingRequests(): void {
		this.pendingRequests.forEach((req, id) => {
			console.warn('Aborting pending request:', req.url);
			req.controller.abort('Request aborted');
			this.pendingRequests.delete(id);
		});
	}
}

export { getNetworkConfigFromQuery } from '@/utils/request';

export type { NetworkConfig }
export { Numeric } from '@/utils/numeric'
export type { SDKWebSocketState } from './websocket';
export * from './errors';