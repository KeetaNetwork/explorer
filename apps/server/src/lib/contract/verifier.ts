/**
 * The contract verifier: a separate service that rebuilds a contract from
 * its source and checks the build is the code deployed. The explorer only
 * reads its results, and passes on requests to verify a contract.
 */
import * as v from 'valibot';
import { parseContractInterface, type ContractInterface } from './interface';

const REQUEST_TIMEOUT_MS = 10_000;

/** How long a contract's verification is reused before asking again */
const CACHE_TTL_MS = 15_000;

/** Most contracts whose verification is kept at once */
const MAX_CACHED_STATUSES = 1024;

const verificationSchema = v.object({
	format: v.string(),
	contract: v.string(),
	codeHash: v.string(),
	builtHash: v.string(),
	verified: v.boolean(),
	source: v.union([
		v.object({ repository: v.string(), commit: v.string() }),
		v.object({ local: v.string() })
	]),
	package: v.string(),
	manifestPath: v.optional(v.nullable(v.string())),
	builder: v.optional(v.nullable(v.object({
		image: v.optional(v.string()),
		dockerfileSha256: v.optional(v.string()),
		agave: v.optional(v.string()),
		platformTools: v.optional(v.string()),
		platform: v.optional(v.string())
	}))),
	interface: v.optional(v.unknown()),
	files: v.optional(v.array(v.object({ path: v.string(), size: v.number() })), []),
	/* Local packages it builds with besides its own, such as the contract SDK: shared by many contracts */
	libraries: v.optional(v.array(v.object({
		name: v.string(),
		version: v.string(),
		dir: v.string(),
		sha256: v.string(),
		files: v.array(v.object({ path: v.string(), size: v.number() }))
	})), []),
	verifiedAt: v.string()
});

const statusSchema = v.object({
	ok: v.boolean(),
	status: v.optional(v.picklist(['none', 'queued', 'running', 'done', 'failed'])),
	error: v.optional(v.nullable(v.string())),
	verification: v.optional(v.nullable(v.unknown())),
	lastAttempt: v.optional(v.nullable(v.unknown()))
});

export type VerificationStatus = 'none' | 'queued' | 'running' | 'done' | 'failed';

export type ContractVerification = Omit<v.InferOutput<typeof verificationSchema>, 'interface'> & {
	interface: ContractInterface | null;
	/** The verifier sent an interface this explorer cannot read */
	interfaceUnreadable?: boolean;
};

export type ContractVerificationStatus = {
	status: VerificationStatus;
	error: string | null;
	/** Present only when a build matched the deployed code */
	verification: ContractVerification | null;
	/** The latest check that did not match, or its error */
	lastAttempt: { [key: string]: unknown } | null;
};

export type VerifyRequest = {
	contract: string;
	repository: string;
	commit: string;
	package: string;
	manifestPath?: string | undefined;
};

export class ContractVerifierError extends Error {
	constructor(message: string, readonly status: number) {
		super(message);
		this.name = 'ContractVerifierError';
	}
}

function parseVerification(input: unknown): ContractVerification | null {
	const result = v.safeParse(verificationSchema, input);
	if (!result.success || !result.output.verified) {
		return(null);
	}

	const contractInterface = result.output.interface === undefined || result.output.interface === null
		? null
		: parseContractInterface(result.output.interface);

	return({
		...result.output,
		interface: contractInterface,
		...(contractInterface === null && result.output.interface ? { interfaceUnreadable: true } : {})
	});
}

export class ContractVerifier {
	readonly baseURL: string;

	#cache = new Map<string, { at: number, value: Promise<ContractVerificationStatus> }>();

	constructor(baseURL: string) {
		const url = new URL(baseURL);
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw(new Error(`The contract verifier's URL must be http(s), not ${url.protocol}`));
		}
		this.baseURL = url.toString().replace(/\/+$/, '');
	}

	async #fetch(path: string, init?: RequestInit): Promise<Response> {
		return(await fetch(`${this.baseURL}${path}`, {
			...init,
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		}));
	}

	/**
	 * A contract's verification: whether and how it was verified, with its
	 * interface
	 */
	async status(contract: string): Promise<ContractVerificationStatus> {
		const cached = this.#cache.get(contract);
		if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
			return(await cached.value);
		}

		/*
		 * Any public key can be asked about: drop what has expired (entries
		 * are in the order they were made), and the oldest beyond a bound
		 */
		const now = Date.now();
		for (const [key, entry] of this.#cache) {
			if (now - entry.at < CACHE_TTL_MS && this.#cache.size < MAX_CACHED_STATUSES) {
				break;
			}
			this.#cache.delete(key);
		}

		const value = this.#status(contract);
		this.#cache.delete(contract);
		this.#cache.set(contract, { at: now, value });
		try {
			return(await value);
		} catch (error) {
			this.#cache.delete(contract);
			throw(error);
		}
	}

	async #status(contract: string): Promise<ContractVerificationStatus> {
		const response = await this.#fetch(`/api/verifications/${encodeURIComponent(contract)}`);
		const body: unknown = await response.json().catch(() => null);
		const parsed = v.safeParse(statusSchema, body);
		if (!parsed.success) {
			throw(new ContractVerifierError(`The contract verifier answered ${response.status} with something unexpected`, 502));
		}

		const { status = 'none', error, verification, lastAttempt } = parsed.output;
		if (!parsed.output.ok && !verification) {
			return({ status: status === 'none' ? 'failed' : status, error: error ?? 'The contract verifier refused the request', verification: null, lastAttempt: null });
		}

		return({
			status,
			error: error ?? null,
			verification: parseVerification(verification),
			lastAttempt: lastAttempt && typeof lastAttempt === 'object' ? lastAttempt as { [key: string]: unknown } : null
		});
	}

	/**
	 * The text of one of the files a contract was verified from, `null` if
	 * the verifier has no such file
	 */
	async file(contract: string, path: string): Promise<string | null> {
		const encodedPath = path.split('/').map(encodeURIComponent).join('/');
		const response = await this.#fetch(`/api/verifications/${encodeURIComponent(contract)}/files/${encodedPath}`);
		if (response.status === 404) {
			return(null);
		}
		if (!response.ok) {
			throw(new ContractVerifierError(`The contract verifier answered ${response.status}`, 502));
		}
		return(await response.text());
	}

	/**
	 * Ask the verifier to verify a contract from a git repository
	 */
	async submit(request: VerifyRequest): Promise<{ status: number, body: unknown }> {
		const response = await this.#fetch('/api/verify', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(request)
		});
		this.#cache.delete(request.contract);
		const body: unknown = await response.json().catch(() => null);
		return({ status: response.status, body });
	}
}
