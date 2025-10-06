import type { WorkerEnv } from "@/lib/explorer/worker";
import { jsonResponse } from "@/utils/response";
import { Hono } from "hono";
import { NotFoundError } from "./errors";

const network = new Hono<WorkerEnv>()
	/**
	 * List Networks
	 */
	.get('/', async (c) => {
		const explorer = c.get('explorer')
		const networks = await explorer.keetaNet.network.listNetworks()
		return jsonResponse(c, { networks })
	})

	/**
	 * Get the node stats
	 */
	.get('/stats', async (c) => {
		const explorer = c.get('explorer')
		const stats = await explorer.keetaNet.node.stats()
		return jsonResponse(c, { stats });
	})

	/**
	 * Get the vote staple for a block
	 */
	.get('/staple/:blockhash', async (c) => {
		const explorer = c.get('explorer')
		const { blockhash } = c.req.param()

		if (blockhash.length !== 64) {
			throw new NotFoundError('Invalid blockhash');
		}

		const voteStaple = await explorer.keetaNet.node.getVoteStaple(blockhash)
		
		const currentBlock = voteStaple.blocks.find(b => b.hash === blockhash);
		if (!currentBlock) {
			throw new NotFoundError('Block not found in vote staple');
		}

		const previousBlockHash = currentBlock.$opening === true ? undefined : currentBlock.previousBlockHash;
		const nextBlockHash = (await explorer.keetaNet.network.client.getSuccessorBlock(blockhash))?.hash.toString();

		return jsonResponse(c, { voteStaple, previousBlockHash, nextBlockHash });
	})

	/**
	 * Get the network settings
	 */
	.get('/settings', async (c) => {
		const keetaNet = c.get('explorer').keetaNet;

		const [hasDemoAccounts, hasFountain] = function() {
			try {
				return([
					!!keetaNet.network.demoAccountSeed,
					!!keetaNet.network.initialTrustedAccount
				]);
			} catch {
				return([false, false]);
			}
		}();

		return jsonResponse(c, {
			settings: {
				hasDemoAccounts,
				hasFountain
			},
			config: {
				networkAlias: keetaNet.network.networkAlias
			}
		});
	})

export default network