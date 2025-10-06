import type { WorkerEnv } from "@/lib/explorer/worker";
import { isValidPublicKey } from "@/utils/network";
import Numeric from "@/utils/numeric";
import { jsonResponse } from "@/utils/response";
import { Hono } from "hono";
import { NotFoundError } from "./errors";
import { getManyTokens } from "./token";

const account = new Hono<WorkerEnv>()
	/**
	 * List all accounts
	 * @deprecated Remove it in next PR
	 */
	.get('/', async (c) => {
		const explorer = c.get('explorer')
		const demoAccounts = explorer.keetaNet.accounts.demoAccounts();
		const accounts = await Promise.all(demoAccounts.map(async function(account) {
			return await account.details();
		}));
		return jsonResponse(c, { accounts });
	})

	/**
	 * Get account details
	 */
	.get('/:accountPublicKey', async (c) => {
		const explorer = c.get('explorer')
		const client = explorer.keetaNet.network.client;
		const { accountPublicKey } = c.req.param()
		
		if (!isValidPublicKey(accountPublicKey)) {
			throw new NotFoundError('Invalid public key');
		}

		const account = explorer.keetaNet.accounts.fromPublicKey(accountPublicKey);
		
		const [details, balances, certificates] = await Promise.all([
			account.details(),
			account.balances(),
			account.certificates(),
		]);

		const tokensPublicKey = balances.map(function({ publicKey }) {
			return(publicKey);
		});
		const tokens = await getManyTokens(client, tokensPublicKey, explorer.keetaNet.network.getBaseToken());

		return jsonResponse(c, {
			account: {
				...details,
				certificates,
				tokens: balances.map(function({ balance, publicKey }) {
					return({
						...tokens[publicKey],
						balance
					});
				})
			}
		});
	})

	/**
	 * Get account certificate
	 */
	.get('/:accountPublicKey/certificate/:certificateHash', async (c) => {
		const explorer = c.get('explorer')
		const { accountPublicKey, certificateHash } = c.req.param()
		
		if (!isValidPublicKey(accountPublicKey)) {
			throw new NotFoundError('Invalid public key');
		}

		const account = explorer.keetaNet.accounts.fromPublicKey(accountPublicKey);

		return jsonResponse(c, { certificate: await account.certificate(certificateHash) });
	})

	/**
	 * Fund an account from the fountain
	 * @deprecated Remove it in next PR
	 */
	.post('/:accountPublicKey/fund-from-fountain', async (c) => {
		const explorer = c.get('explorer')
		const { accountPublicKey } = c.req.param()

		if (!isValidPublicKey(accountPublicKey)) {
			throw new NotFoundError('Invalid public key');
		}
		
		const body = await c.req.json() as { amount: string }
		const amount = new Numeric(body.amount)
		
		if (amount.valueOf() < 0n) {
			throw(new Error('Amount should be greater than 0'));
		}

		const account = explorer.keetaNet.accounts.fromPublicKey(accountPublicKey);
		await account.fundFromFountain(amount);
		
		return jsonResponse(c, { account: await account.details() });
	})

	/**
	 * Send tokens to another account
	 * @deprecated Remove it in next PR
	 */
	.post('/:accountPublicKey/send-to-account', async (c) => {
		const explorer = c.get('explorer')
		const { accountPublicKey } = c.req.param()

		if (!isValidPublicKey(accountPublicKey)) {
			throw new NotFoundError('Invalid public key');
		}

		const body = await c.req.json() as { toAccount: string, amount: string }
		const amount = new Numeric(body.amount)
		if (amount.valueOf() < 0n) {
			throw(new Error('Amount should be greater than 0'));
		}

		const response = await explorer.keetaNet.accounts.moveDemoAccountTokens(
			accountPublicKey,
			body.toAccount,
			amount
		);
		return jsonResponse(c, response);
	})

export default account