import type { WorkerEnv } from "@/lib/explorer/worker";
import { isValidPublicKey } from "@/utils/network";
import Numeric from "@/utils/numeric";
import { jsonResponse } from "@/utils/response";
import { Hono } from "hono";
import { NotFoundError } from "./errors";
import { KeetaNet } from "@keetanetwork/anchor";
import { getManyTokens } from "./token";

const storage = new Hono<WorkerEnv>()
	/**
	 * Get account details
	 */
	.get('/:accountPublicKey', async (c) => {
		const explorer = c.get('explorer')
		const { accountPublicKey } = c.req.param()
		const userAccount = KeetaNet.lib.Account.fromPublicKeyString(accountPublicKey);
		const userClient = explorer.keetaNet.network.getUserClient(userAccount as any);
		const client = userClient.client;
		
		if (!isValidPublicKey(accountPublicKey)) {
			throw new NotFoundError('Invalid public key');
		}

		const state = await userClient.state()

		const balances = state.balances.map(function(balance) {
			return({
				publicKey: balance.token.publicKeyString.toString(),
				balance: new Numeric(balance.balance.toString())
			});
		});

		const tokensPublicKey = balances.map(function({ publicKey }) {
			return(publicKey);
		});
		const tokens = await getManyTokens(client, tokensPublicKey, explorer.keetaNet.network.getBaseToken());

		const account = {
			publicKey: accountPublicKey,
			headBlock: state.currentHeadBlock,
			info: KeetaNet.lib.Utils.Conversion.toJSONSerializable(state.info),
			tokens: balances.map(function({ balance, publicKey }) {
				return({
					...tokens[publicKey],
					balance
				});
			})

		}

		return jsonResponse(c, { account });
	})

export default storage