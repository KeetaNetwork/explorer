import { KeetaNetLib } from "@/utils/keetanet";
import { Network, type KeetaNetAccount } from '@/lib/network';
import Numeric from '@/utils/numeric';
import { voteStaplesAsTransactions } from './transaction';
import { WithKeetaNet } from './base';
import type { KeetaNet } from '.';
import { NotFoundError } from "@/api/errors";
import * as KeetaNetAnchor from "@keetanetwork/anchor";

export type AccountDetails = {
	publicKey: string;
	headBlock: string | null;

	info: {
		name: string;
		description: string;
		metadata: string;
		delegatedTo: string | null;
	}
};

type AccountState = Awaited<ReturnType<typeof KeetaNetLib.UserClient.prototype.state>>;

/**
 * Account
 */
export class Account extends WithKeetaNet {
	#account: KeetaNetAccount;
	#statePromise?: Promise<AccountState>;

	constructor(account: string | number | KeetaNetAccount, client: KeetaNet) {
		super(client);
		if (typeof account === 'string') {
			this.#account = KeetaNetLib.lib.Account.fromPublicKeyString(account).assertAccount();
		} else if (typeof account === 'number') {
			if (!this.keetaNet.network.demoAccountSeed) {
				throw(new Error(`Demo account seed not found for network ${this.keetaNet.network.networkAlias}`));
			}
			this.#account = KeetaNetLib.lib.Account.fromSeed(this.keetaNet.network.demoAccountSeed, account);
		} else {
			this.#account = account;
		}
	}

	/**
	 * Compare public keys
	 */
	comparePublicKey(publicKey: Parameters<KeetaNetAccount['comparePublicKey']>[0]): boolean {
		return(this.#account.comparePublicKey(publicKey));
	}

	async state(): Promise<AccountState> {
		if (this.#statePromise) {
			return this.#statePromise;
		}
		this.#statePromise = this.keetaNet.network.getUserClient(this.#account).state();
		return(this.#statePromise);
	}


	/**
	 * Get the details of the account
	 */
	async details(): Promise<AccountDetails> {
		const state = await this.state();
		
		const headBlock = state.currentHeadBlock;
		const publicKey = this.#account.publicKeyString.get();
		const info = {
			...state.info,
			delegatedTo: state.representative?.publicKeyString.toString() || null
		};

		return({ publicKey, headBlock, info });
	}

	/**
	 * Get the account balance in all tokens
	 */
	async balances() {
		const state = await this.state();

		return(state.balances.map(function(balance) {
			return({
				publicKey: balance.token.publicKeyString.toString(),
				balance: new Numeric(balance.balance.toString())
			});
		}));
	}

	/**
	 * Get the account certificates
	 */
	async certificates() {
		const client = this.keetaNet.network.getUserClient(this.#account);
		const certificates = await client.getCertificates();
		return(certificates.map(function({ certificate }) {

			let issuer = certificate.issuerDN.find(({ name }) => name === "commonName")?.value
			if (issuer?.startsWith("keeta_")) {
				issuer = certificate.issuerDN.find(({ name }) => name === "2.5.4.10" || name === "organizationName")?.value
			}

			return({
				issuer,
				hash: certificate.hash().toString(),
				issuedAt: certificate.notBefore,
				expiresAt: certificate.notAfter,
			});
		}).sort((a, b) => {
			return b.issuedAt.getTime() - a.issuedAt.getTime();
		}));
	}

	#certificateToAPIResponse(certificate: KeetaNetAnchor.lib.Certificates.Certificate | typeof KeetaNetLib.lib.Utils.Certificate.Certificate.prototype) {
		let issuerName = certificate.issuerDN.find(({ name }) => name === "commonName")?.value
		if (issuerName?.startsWith("keeta_")) {
			issuerName = certificate.issuerDN.find(({ name }) => name === "2.5.4.10" || name === "organizationName")?.value
		}
		
		let subjectName = certificate.subjectDN.find(({ name }) => name === "commonName")?.value
		if (subjectName?.startsWith("keeta_")) {
			subjectName = certificate.subjectDN.find(({ name }) => name === "2.5.4.10" || name === "organizationName")?.value
		}

		const attributes: { name: string, sensitive: boolean, value: string | null }[] = []
		if (certificate instanceof KeetaNetAnchor.lib.Certificates.Certificate) {
			Object.entries(certificate.attributes).forEach(([name, value]) => {
				attributes.push({
					name,
					sensitive: value.sensitive,
					value: value.sensitive ? null : new TextDecoder().decode(value.value),
				})
			})
		}

		return({
			issuerName,
			subjectName,
			subjectPublicKey: certificate.subjectPublicKey.publicKeyString.toString(),
			isSelfSigned: certificate.isSelfSigned(),
			hash: certificate.hash().toString(),
			serial: certificate.serial,
			valid: certificate.checkValid(),
			trusted: certificate.trusted,
			issuedAt: certificate.notBefore,
			expiresAt: certificate.notAfter,
			issuerDN: certificate.issuerDN,
			subjectDN: certificate.subjectDN,
			attributes,
		});
	}

	async certificate(certificateHash: string) {
		const rootCA = Network.getDefaultConfig(this.keetaNet.network.networkAlias).rootCA;
		const rootCAObject = new KeetaNetAnchor.lib.Certificates.Certificate(rootCA, { isTrustedRoot: true })

		const client = this.keetaNet.network.getUserClient(this.#account);
		const response = await client.getCertificates(certificateHash);
		if (!response) {
			throw(new NotFoundError('Certificate not found'));
		}

		const { certificate, intermediates } = response;

		try {
			/**
			 * Trusted chain
			 */
			const store = {
				store: {
					root: new Set([rootCAObject]),
					intermediate: intermediates ? new Set(intermediates.getCertificates()) : undefined,
				},
			};

			const kycCertificate = new KeetaNetAnchor.lib.Certificates.Certificate(certificate, store)
			return {
				...this.#certificateToAPIResponse(kycCertificate),
				chain: kycCertificate.chain?.map(c => this.#certificateToAPIResponse(
					(c.trusted ? c : new KeetaNetAnchor.lib.Certificates.Certificate(c, store))
				)) ?? [],
				pem: certificate.toPEM(),
			}
		} catch {
			/**
			 * Untrusted chain
			 */
			const kycCertificate = new KeetaNetAnchor.lib.Certificates.Certificate(certificate)
			
			return {
				...this.#certificateToAPIResponse(kycCertificate),
				chain: intermediates?.getCertificates().map(c => this.#certificateToAPIResponse(c)) ?? [],
				pem: certificate.toPEM(),
			}
		}
	}

	/**
	 * Fund an account from the fountain
	 * @deprecated Remove it in next PR
	 */
	async fundFromFountain(amount: Numeric) {
		if (!this.keetaNet.network.initialTrustedAccount) {
			throw(new Error('Not allowed to fund account'));
		}

		const client = this.keetaNet.network.getUserClient(this.#account);

		const convertedAmount = BigInt(amount.toString());

		// trusted account to sign the transaction
		const baseToken = this.keetaNet.network.getBaseToken();

		const builder = client.initBuilder();
		builder.modifyTokenSupply(convertedAmount, { account: baseToken, signer: this.keetaNet.network.initialTrustedAccount });
		builder.modifyTokenBalance(baseToken, convertedAmount, undefined, { account: this.#account, signer: this.keetaNet.network.initialTrustedAccount });
		await client.publishBuilder(builder);
	}

	/**
	 * Send tokens to an account
	 * @deprecated Remove it in next PR
	 */
	async sendTokens(toPublicKey: string | Account, amount: Numeric) {
		const client = this.keetaNet.network.getUserClient(this.#account);

		let destination: string | KeetaNetAccount;
		if (typeof toPublicKey === 'string') {
			destination = toPublicKey;
		} else {
			destination = toPublicKey.#account;
		}

		await client.send(destination, Number(amount), client.baseToken);
	}

	/**
	 * List transactions
	 */
	async transactions(startBlock?: string, depth: number = 20) {
		const accountPublicKey = this.#account.publicKeyString.toString();
		const history = await this.keetaNet.network.client.getHistory(this.#account, { startBlocksHash: startBlock, depth });
		const voteStaples = history.flatMap(function({ voteStaple }) {
			return voteStaple;
		});

		const transactions = voteStaplesAsTransactions(voteStaples, accountPublicKey);
		const previousBlockHash = history.at(-1)?.voteStaple.blocksHash.toString() ?? null;

		return({ transactions, previousBlockHash });
	}
}

/**
 * Accounts
 */
export class Accounts extends WithKeetaNet {
	/**
	 * Create an account from a public key
	 */
	fromPublicKey(accountPublicKey: string): Account {
		return(new Account(accountPublicKey, this.keetaNet));
	}

	/**
	 * Create an account from a number
	 * @deprecated Remove it in next PR
	 */
	#fromDemoAccountIndex(accountNumber: number): Account {
		return(new Account(accountNumber, this.keetaNet));
	}

	/**
	 * Demo accounts
	 * @deprecated Remove it in next PR
	 */
	demoAccounts(): Account[] {
		if (!this.keetaNet.network.demoAccountSeed) {
			return([]);
		}

		return([0, 1].map(accountPublicKey => {
			return(this.#fromDemoAccountIndex(accountPublicKey));
		}));
	}

	/**
	 * Move tokens from one demo account to another
	 * @deprecated Remove it in next PR
	 */
	async moveDemoAccountTokens(fromAccountPublicKey: string, toAccountPublicKey: string, amount: Numeric) {
		const demoAccounts = this.demoAccounts();
		if (demoAccounts.length === 0) {
			throw(new Error('No demo accounts found'));
		}

		/**
		 * Find the demo accounts
		 */
		const fromAccount = demoAccounts.find(function(account) {
			return account.comparePublicKey(fromAccountPublicKey);
		});

		const toAccount = demoAccounts.find(function(account) {
			return account.comparePublicKey(toAccountPublicKey);
		});

		if (!fromAccount || !toAccount) {
			throw(new Error('Demo account not found'));
		}

		/**
		 * Send tokens
		 */
		await fromAccount.sendTokens(toAccount, amount);

		/**
		 * Get the account details
		 */
		const [fromAccountDetails, toAccountDetails] = await Promise.all([
			fromAccount.details(),
			toAccount.details()
		]);
		return({
			fromAccount: fromAccountDetails,
			toAccount: toAccountDetails
		});
	}
}
