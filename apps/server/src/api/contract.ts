import type { WorkerEnv } from "@/lib/explorer/worker";
import type { Context } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { validator } from "hono/validator";
import * as v from "valibot";
import { isValidPublicKey } from "@/utils/network";
import { jsonResponse } from "@/utils/response";
import { Contracts } from "@/lib/keetanet/contract";
import { ContractVerifierError } from "@/lib/contract/verifier";
import { NotFoundError } from "./errors";

/**
 * Contracts (on networks whose client knows them): their record and code,
 * decoded state and calls, and the verifier's result
 */
function contractsOf(c: Context<WorkerEnv>): Contracts {
	const explorer = c.get('explorer');
	return(new Contracts(explorer.keetaNet.network, explorer.contractVerifier));
}

function assertContractAddress(contract: string): void {
	if (!isValidPublicKey(contract)) {
		throw(new NotFoundError('Invalid public key'));
	}
}

const blockhashSchema = v.pipe(v.string(), v.regex(/^[0-9a-fA-F]{64}$/, 'Invalid blockhash'));

const historyQuerySchema = v.object({
	startBlock: v.optional(blockhashSchema),
	depth: v.optional(v.pipe(v.string(), v.transform(value => parseInt(value, 10)), v.number(), v.integer(), v.minValue(1), v.maxValue(50)))
});

const stateQuerySchema = v.object({
	startAfter: v.optional(v.pipe(v.string(), v.regex(/^[0-9a-fA-F]{64}$/, 'Invalid state account id'))),
	limit: v.optional(v.pipe(v.string(), v.transform(value => parseInt(value, 10)), v.number(), v.integer(), v.minValue(1), v.maxValue(200)))
});

const verifyBodySchema = v.object({
	repository: v.pipe(v.string(), v.url(), v.startsWith('https://', 'The repository must be an https git URL')),
	commit: v.pipe(v.string(), v.regex(/^[0-9a-f]{40}$/, 'The commit must be a full 40-character hash')),
	package: v.pipe(v.string(), v.minLength(1)),
	manifestPath: v.optional(v.pipe(v.string(), v.minLength(1)))
});

/**
 * Validate input, refusing what does not fit with a 400
 */
function parseInput<T extends v.GenericSchema>(schema: T) {
	return(function(value: unknown): v.InferOutput<T> {
		const result = v.safeParse(schema, value);
		if (!result.success) {
			throw(new HTTPException(400, { message: result.issues.map(issue => issue.message).join('; ') }));
		}
		return(result.output);
	});
}

function verifierFailure(c: Context<WorkerEnv>, error: unknown) {
	const message = error instanceof ContractVerifierError
		? error.message
		: `The contract verifier is unreachable: ${error instanceof Error ? error.message : String(error)}`;
	return(c.json({ message }, 502));
}

const contract = new Hono<WorkerEnv>()
	/**
	 * The contract calls in the staple holding a block, decoded, with their
	 * outcomes
	 */
	.get('/staple/:blockhash/calls', async (c) => {
		const { blockhash } = c.req.param();
		if (!v.is(blockhashSchema, blockhash)) {
			throw(new NotFoundError('Invalid blockhash'));
		}

		const contracts = contractsOf(c);
		if (!contracts.supported) {
			return(jsonResponse(c, { supported: false, voteStapleHash: null, calls: [], hasOutcomes: false }));
		}

		const result = await contracts.stapleCalls(blockhash);
		if (!result) {
			throw(new NotFoundError('Vote staple not found'));
		}
		return(jsonResponse(c, { supported: true, ...result }));
	})

	/**
	 * A contract's record: its code hash, admin, creator and sequencer
	 */
	.get('/:contract', async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const contracts = contractsOf(c);
		const record = await contracts.record(contract);
		if (!record) {
			throw(new NotFoundError('Contract not found'));
		}

		return(jsonResponse(c, { contract: record, hasVerifier: contracts.hasVerifier }));
	})

	/**
	 * A contract's code: its size and hash
	 */
	.get('/:contract/code/info', async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const code = await contractsOf(c).code(contract);
		if (!code) {
			throw(new NotFoundError('Contract not found'));
		}

		return(jsonResponse(c, { code: { codeHash: code.codeHash, size: code.code.length, source: code.source } }));
	})

	/**
	 * Download a contract's code (an sBPF ELF file)
	 */
	.get('/:contract/code', async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const code = await contractsOf(c).code(contract);
		if (!code) {
			throw(new NotFoundError('Contract not found'));
		}

		return(c.body(new Uint8Array(code.code), 200, {
			'Content-Type': 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${contract}.so"`,
			'Content-Length': String(code.code.length),
			'X-Contract-Code-Hash': code.codeHash
		}));
	})

	/**
	 * The verifier's result for a contract; `null` if no verifier is
	 * configured
	 */
	.get('/:contract/verification', async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const contracts = contractsOf(c);
		if (!contracts.hasVerifier) {
			return(jsonResponse(c, { verification: null }));
		}

		const [record, result] = await Promise.all([
			contracts.record(contract),
			contracts.verification(contract).then(
				status => ({ status }),
				(error: unknown) => ({ error })
			)
		]);
		if (!record) {
			throw(new NotFoundError('Contract not found'));
		}
		if ('error' in result || result.status === null) {
			return(verifierFailure(c, 'error' in result ? result.error : null));
		}
		const { status } = result;

		/* A verification of other code (before an upgrade) does not verify this code */
		const matchesCode = status.verification !== null && status.verification.codeHash.toLowerCase() === record.codeHash;
		return(jsonResponse(c, { verification: { ...status, matchesCode } }));
	})

	/**
	 * The text of one of the files a contract was verified from
	 */
	.get('/:contract/verification/files/*', async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const prefix = `/verification/files/`;
		let path: string;
		try {
			path = decodeURIComponent(c.req.path.slice(c.req.path.indexOf(prefix) + prefix.length));
		} catch {
			throw(new NotFoundError('Invalid file path'));
		}
		if (!path || path.split('/').some(part => part === '..' || part === '')) {
			throw(new NotFoundError('Invalid file path'));
		}

		const verifier = contractsOf(c).verifier;
		if (!verifier) {
			throw(new NotFoundError('No contract verifier is configured'));
		}

		let text: string | null;
		try {
			text = await verifier.file(contract, path);
		} catch (error) {
			return(verifierFailure(c, error));
		}
		if (text === null) {
			throw(new NotFoundError('File not found'));
		}
		return(jsonResponse(c, { path, text }));
	})

	/**
	 * Ask the verifier to verify a contract from a git repository
	 */
	.post('/:contract/verification', validator('json', parseInput(verifyBodySchema)), async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const verifier = contractsOf(c).verifier;
		if (!verifier) {
			throw(new NotFoundError('No contract verifier is configured'));
		}

		const body = c.req.valid('json');
		let response: Awaited<ReturnType<typeof verifier.submit>>;
		try {
			response = await verifier.submit({ contract, ...body });
		} catch (error) {
			return(verifierFailure(c, error));
		}

		const answer = response.body && typeof response.body === 'object' ? response.body as { [key: string]: unknown } : {};
		if (response.status >= 400) {
			const message = typeof answer.error === 'string' ? answer.error : `The contract verifier answered ${response.status}`;
			return(c.json({ message }, response.status === 404 ? 404 : 400));
		}
		return(jsonResponse(c, { submitted: true, status: typeof answer.status === 'string' ? answer.status : 'queued' }, 202));
	})

	/**
	 * A page of a contract's state accounts, decoded with its interface
	 */
	.get('/:contract/state', validator('query', parseInput(stateQuerySchema)), async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const result = await contractsOf(c).state(contract, c.req.valid('query'));
		if (!result) {
			throw(new NotFoundError('Contract not found'));
		}
		return(jsonResponse(c, result));
	})

	/**
	 * A page of a contract's calls, most recent first, with decoded
	 * instructions and outcomes
	 */
	.get('/:contract/calls', validator('query', parseInput(historyQuerySchema)), async (c) => {
		const { contract } = c.req.param();
		assertContractAddress(contract);

		const result = await contractsOf(c).calls(contract, c.req.valid('query'));
		if (!result) {
			throw(new NotFoundError('Contract not found'));
		}
		return(jsonResponse(c, result));
	});

export default contract;
