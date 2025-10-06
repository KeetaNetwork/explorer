import type { WorkerEnv } from "@/lib/explorer/worker";
import { jsonResponse } from "@/utils/response";
import { Hono } from "hono";
import * as v from "valibot";
import { parse } from "valibot";
import { validator } from "hono/validator";
import { getCertificateHash, normalizeOperations, type NormalizedOperation, type NormalizedOperationMANAGE_CERTIFICATE } from "@keetanetwork/web-ui-utils/helpers/keetanet-operations";
import { KeetaNetLib } from "@/utils/keetanet";

const transactionQuerySchema = v.optional(v.object({
	startBlock: v.optional(v.string()),
	depth: v.optional(v.pipe(v.string(), v.transform(v => parseInt(v, 10)))),
	publicKey: v.optional(v.string()),
}));

function normalizedOperationToJSONSerializable(op: NormalizedOperation) {
	const { block: { operations, ...block}, ...serialized } = KeetaNetLib.lib.Utils.Conversion.toJSONSerializable(op);
	if (serialized.type === "MANAGE_CERTIFICATE") {
		const manageOperation = op as NormalizedOperationMANAGE_CERTIFICATE;
		return {
			...serialized,
			block,
			operation: {
				method: manageOperation.operation.method,
				certificateOrHash: getCertificateHash(manageOperation.operation)
			}
		}
	}
	return { ...serialized, block };
}

const transaction = new Hono<WorkerEnv>()
	/**
	 * List all ledger transactions
	 */
	.get('/', validator('query', v => parse(transactionQuerySchema, v)), async (c) => {
		const query = c.req.valid("query");
		const startBlocksHash = query?.startBlock
		const depth = query?.depth ?? 20;
		const publicKey = query?.publicKey

		const account = publicKey ? KeetaNetLib.lib.Account.fromPublicKeyString(publicKey) : null;
		const history = await c.get('explorer').keetaNet.network.client.getHistory(account, { depth, startBlocksHash });

		const voteStaples = history.flatMap(function({ voteStaple }) {
			return voteStaple;
		});

		const normalizedOperations = normalizeOperations(voteStaples, account)
		const stapleOperations = normalizedOperations.map(normalizedOperationToJSONSerializable);
		const nextCursor = (account && stapleOperations.find(op => op.block.$opening && account.comparePublicKey(op.block.account))) ? null : stapleOperations.at(-1)?.voteStapleHash
		
		return jsonResponse(c, { nextCursor, stapleOperations });
	})

export default transaction