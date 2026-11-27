import type { ApiRoute } from "@/api";
import { hc } from "hono/client";
import type { NetworkConfig } from "@/lib/network";
import { createHeaderFromNetworkConfig } from "@/utils/request";
import { ClientHTTPError, ClientNotFoundError, ClientUnauthorizedError } from "./errors";
import { withSuperJSON } from "./response";

/**
 * Contracts can take longer than other requests: a representative may be
 * slow to give a contract's code, which is then found in its history
 */
const DEFAULT_REQUEST_TIMEOUT = 30_000;

export interface ExplorerContractsSDKConfig {
	/** Base URL of the explorer's API, such as `http://localhost:3010/` */
	baseURL: string;
	networkConfig: NetworkConfig;
	timeoutMs?: number;
}

/**
 * An error from the explorer's API, with the message it gave
 */
async function responseError(response: Response): Promise<Error> {
	let message = response.statusText;
	try {
		const body: unknown = await response.clone().json();
		if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
			message = body.message;
		}
	} catch {
		/* Keep the status text */
	}

	if (response.status === 404) {
		return(new ClientNotFoundError(message));
	} else if (response.status === 401) {
		return(new ClientUnauthorizedError(message));
	}
	return(new ClientHTTPError(response.status, message));
}

/**
 * Client for the explorer API's contract routes: a contract's record,
 * code, verification, decoded state and calls
 */
export class ExplorerContractsSDK {
	readonly config: Required<ExplorerContractsSDKConfig>;
	readonly client: ReturnType<typeof hc<ApiRoute>>;

	constructor(config: ExplorerContractsSDKConfig) {
		const baseURL = new URL(config.baseURL);
		if (baseURL.pathname === '/') {
			baseURL.pathname = '/api/v1/';
		}
		this.config = { timeoutMs: DEFAULT_REQUEST_TIMEOUT, ...config, baseURL: baseURL.toString() };

		this.client = hc<ApiRoute>(this.config.baseURL, {
			headers: () => createHeaderFromNetworkConfig(this.config.networkConfig),
			fetch: async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
				const response = await fetch(input, { ...init, signal: AbortSignal.timeout(this.config.timeoutMs) });
				if (!response.ok) {
					throw(await responseError(response));
				}
				return(withSuperJSON(response));
			}
		});
	}

	#url(path: string): string {
		const url = new URL(path, this.config.baseURL);
		url.searchParams.set('networkAlias', this.config.networkConfig.networkAlias);
		return(url.toString());
	}

	/** A contract's record (code hash, admin, creator, sequencer); throws {@link ClientNotFoundError} if it is not a contract */
	async get(contract: string) {
		const response = await this.client.contract[':contract'].$get({ param: { contract } });
		return(await response.json());
	}

	/** The size and hash of a contract's code */
	async codeInfo(contract: string) {
		const response = await this.client.contract[':contract'].code.info.$get({ param: { contract } });
		return(await response.json());
	}

	/** Where to download a contract's code */
	codeURL(contract: string): string {
		return(this.#url(`contract/${encodeURIComponent(contract)}/code`));
	}

	/** The verifier's result; `verification: null` if the explorer has no verifier */
	async verification(contract: string) {
		const response = await this.client.contract[':contract'].verification.$get({ param: { contract } });
		return(await response.json());
	}

	/** The text of a file the contract was verified from */
	async verificationFile(contract: string, path: string): Promise<{ path: string, text: string }> {
		const encodedPath = path.split('/').map(encodeURIComponent).join('/');
		const response = await fetch(this.#url(`contract/${encodeURIComponent(contract)}/verification/files/${encodedPath}`), {
			headers: createHeaderFromNetworkConfig(this.config.networkConfig),
			signal: AbortSignal.timeout(this.config.timeoutMs)
		});
		if (!response.ok) {
			throw(await responseError(response));
		}
		return(await withSuperJSON(response).json() as { path: string, text: string });
	}

	/** Ask the verifier to verify a contract from a git repository */
	async submitVerification(contract: string, request: { repository: string, commit: string, package: string, manifestPath?: string }) {
		const response = await this.client.contract[':contract'].verification.$post({ param: { contract }, json: request });
		return(await response.json());
	}

	/** A page of the contract's state accounts, decoded */
	async state(contract: string, query: { startAfter?: string, limit?: string } = {}) {
		const response = await this.client.contract[':contract'].state.$get({ param: { contract }, query });
		return(await response.json());
	}

	/** A page of the contract's calls, most recent first, decoded */
	async calls(contract: string, query: { startBlock?: string, depth?: string } = {}) {
		const response = await this.client.contract[':contract'].calls.$get({ param: { contract }, query });
		return(await response.json());
	}

	/** The contract calls in the staple holding a block, decoded, with their outcomes */
	async stapleCalls(blockhash: string) {
		const response = await this.client.contract.staple[':blockhash'].calls.$get({ param: { blockhash } });
		return(await response.json());
	}
}
