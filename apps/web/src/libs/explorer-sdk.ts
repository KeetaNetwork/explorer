import * as v from "valibot";
import * as Anchor from "@keetanetwork/anchor";
import { ClientNotFoundError, ExplorerSDK, type ExplorerSDKConfig, type NetworkConfig } from '@keetanetwork/explorer-client';
import type { GenericAccount, NormalizedOperation, NormalizedOperationMANAGE_CERTIFICATE } from '@keetanetwork/web-ui/helpers/keetanet-operations';
import { getCertificateHash, normalizeOperations } from '@keetanetwork/web-ui/helpers/keetanet-operations'; // eslint-disable-line no-duplicate-imports
import { TokenBatcher } from "./token-batcher";
import { Numeric } from "@keetanetwork/web-ui/helpers/Numeric";
import { networkConfig } from "./networkConfig";

const KeetaNetLib = Anchor.KeetaNet;

/**
 * Schemas
 */
const transactionQuerySchema = v.optional(v.object({
	startBlock: v.optional(v.string()),
	depth: v.optional(v.pipe(v.string(), v.transform(v => parseInt(v, 10)))),
	publicKey: v.optional(v.string()),
}));
type TransactionQuery = v.InferInput<typeof transactionQuerySchema>;

/**
 * Helpers
 */
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

function certificateToAPIResponse(certificate: Anchor.lib.Certificates.Certificate | typeof KeetaNetLib.lib.Utils.Certificate.Certificate.prototype) {
	let issuerName = certificate.issuerDN.find(({ name }) => name === "commonName")?.value
	if (issuerName?.startsWith("keeta_")) {
		issuerName = certificate.issuerDN.find(({ name }) => name === "2.5.4.10" || name === "organizationName")?.value
	}

	let subjectName = certificate.subjectDN.find(({ name }) => name === "commonName")?.value
	if (subjectName?.startsWith("keeta_")) {
		subjectName = certificate.subjectDN.find(({ name }) => name === "2.5.4.10" || name === "organizationName")?.value
	}

	const attributes: { name: string, sensitive: boolean, value: string | null }[] = []
	if (certificate instanceof Anchor.lib.Certificates.Certificate) {
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
		pem: certificate.toPEM(),
	}) as const;
}

/**
 * Keeta Explorer SDK Client for the web application.
 */
export class ExplorerClientSDK {

	config!: Required<ExplorerSDKConfig>;

	client!: InstanceType<typeof Anchor.KeetaNet.Client>;

	baseToken!: GenericAccount;

	constructor(options: ExplorerSDKConfig) {
		console.log('ExplorerSDK config:', options);
		const {
			baseURL = 'https://explorer.test.keeta.com/',
			networkConfig = { networkAlias: "test" },
			timeoutMs = 15000
		} = options;

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

		const userClient = KeetaNetLib.UserClient.fromNetwork(this.config.networkConfig.networkAlias, null);
		this.baseToken = userClient.baseToken
		this.client = userClient.client;
	}

	/**
	 * Update the network configuration.
	 */
	async updateNetworkConfig(networkConfig: NetworkConfig) {
		// Validate the network before changing the config
		try {
			// await this.client.network.settings.$get({}, {
			// 	headers: createHeaderFromNetworkConfig(networkConfig)
			// });
			//
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
				const { info, balances, currentHeadBlock, representative, account: accountInfo } = await this.client.getAccountInfo(accountPublicKey)

				const certificates = ((await this.client.getAllCertificates(accountPublicKey)).map(({ certificate }) => {
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

				let signers = null
				let owner = null
				if (accountInfo.isMultisig()) {
					const acls = await this.client.listACLsByEntity(accountPublicKey)
					signers = acls.filter(a => a.permissions.has(['MULTISIG_SIGNER'])).map(a => a.principal.publicKeyString.get())
				} else if (accountInfo.isStorage()) {
					const acls = await this.client.listACLsByEntity(accountPublicKey)
					owner = acls.find(a => a.permissions.has(['OWNER']))?.principal.publicKeyString.get() ?? null
				}

				const account = {
					type: (accountInfo.isMultisig() ? 'MULTISIG' : accountInfo.isStorage() ? 'STORAGE' : accountInfo.isToken() ? 'TOKEN' : accountInfo.isAccount() ? 'ACCOUNT' : 'UNKNOWN') as 'MULTISIG' | 'STORAGE' | 'TOKEN' | 'ACCOUNT' | 'UNKNOWN',
					signers,
					owner,
					publicKey: accountPublicKey,
					headBlock: currentHeadBlock,
					info: KeetaNetLib.lib.Utils.Conversion.toJSONSerializable(info),
					representative: representative ? KeetaNetLib.lib.Utils.Conversion.toJSONSerializable(representative) : null,
					tokens: await Promise.all(balances.map(async ({ token, balance }) => {
						return {
							...await (this.tokens.get(token.publicKeyString.get()).then(r => r.token)),
							balance: new Numeric(balance)
						};
					})),
					certificates,
				}

				return ({ account })
			},

			certificate: async (accountPublicKey: string, certificateHash: string) => {
				const { rootCA } = networkConfig[this.config.networkConfig.networkAlias]
				const rootCAObject = new Anchor.lib.Certificates.Certificate(rootCA, { isTrustedRoot: true })

				const response = await this.client.getCertificateByHash(accountPublicKey, certificateHash)
				if (!response) {
					throw(new ClientNotFoundError('Certificate not found'));
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

					const kycCertificate = new Anchor.lib.Certificates.Certificate(certificate, store)
					return ({
						certificate: {
							...certificateToAPIResponse(kycCertificate),
							chain: kycCertificate.chain?.map(c => certificateToAPIResponse(
								(c.trusted ? c : new Anchor.lib.Certificates.Certificate(c, store))
							)) ?? [],
							pem: certificate.toPEM(),
						}
					})
				} catch {
					/**
					 * Untrusted chain
					 */
					const kycCertificate = new Anchor.lib.Certificates.Certificate(certificate)

					return ({
						certificate: {
							...certificateToAPIResponse(kycCertificate),
							chain: intermediates?.getCertificates().map(c => certificateToAPIResponse(c)) ?? [],
							pem: certificate.toPEM(),
						}
					})
				}
			}
		}
	}

	get storage() {
		return {
			details: async (accountPublicKey: string) => {
				return this.account.details(accountPublicKey);
			},
		}
	}

	get network() {
		return {
			stats: async () => {
				const nodeStats = await this.client.getNodeStats();
				const stats = ({
					queryTime: nodeStats.ledger.momentRange * 2,
					blockCount: nodeStats.ledger.blockCount,
					transactionCount: nodeStats.ledger.transactionCount,
					representativeCount: nodeStats.ledger.representativeCount,
					time: new Date(nodeStats.ledger.moment),
				});
				return({ stats });
			},

			getVoteStaple: async (blockhash: string) => {
				if (blockhash.length !== 64) {
					throw new ClientNotFoundError('Invalid blockhash');
				}

				const voteStaple = await this.client.getVoteStaple(blockhash)

				if (!voteStaple) {
					throw new ClientNotFoundError('Vote staple not found');
				}

				const currentBlock = voteStaple.blocks.find(b => b.hash.toString() === blockhash);
				if (!currentBlock) {
					throw new ClientNotFoundError('Block not found in vote staple');
				}

				const previousBlockHash = currentBlock.$opening === true ? undefined : currentBlock.previous;
				const nextBlockHash = (await this.client.getSuccessorBlock(blockhash))?.hash.toString();

				const blocksHash = voteStaple.blocksHash;

				return ({
					voteStaple: {
						votes: KeetaNetLib.lib.Utils.Conversion.toJSONSerializable(voteStaple.votes),
						blocks: voteStaple.blocks.map(b => {
							const normalizedOperations = normalizeOperations([{ votes: [], blocks: [b], blocksHash } as any], null)
							const normalizedBlock = KeetaNetLib.lib.Utils.Conversion.toJSONSerializable(b);
							return({
								...normalizedBlock,
								operations: normalizedOperations.map(normalizedOperationToJSONSerializable)
							});
						}),
						originalContent: JSON.stringify(KeetaNetLib.lib.Utils.Conversion.toJSONSerializable(voteStaple), null, "\t")
					},
					previousBlockHash,
					nextBlockHash
				});
			},

			list: async () => {
				const envNetworks = ((import.meta.env.VITE_APP_AVAILABLE_NETWORKS as string) ?? "").split(",").map(n => n.trim()).filter(n => n.length > 0);
				const networks = envNetworks.map(networkAlias => ({ networkAlias }));
				return({ networks })
			},
		}
	}

	async transactions(input?: TransactionQuery) {
		const query = v.parse(transactionQuerySchema, input);
		const startBlocksHash = query?.startBlock
		const depth = query?.depth ?? 20;
		const publicKey = query?.publicKey

		const account = publicKey ? KeetaNetLib.lib.Account.fromPublicKeyString(publicKey) : null;
		const history = await this.client.getHistory(account, { depth, startBlocksHash });

		const voteStaples = history.flatMap(({ voteStaple }) => {
			return voteStaple;
		});

		const normalizedOperations = normalizeOperations(voteStaples, account)
		const stapleOperations = normalizedOperations.map(normalizedOperationToJSONSerializable);
		const nextCursor = (account && stapleOperations.find(op => op.block.$opening && account.comparePublicKey(op.block.account))) ? null : stapleOperations.at(-1)?.voteStapleHash

		return({ nextCursor, stapleOperations });
	}

	#tokenBatcher?: TokenBatcher;
	get tokens() {
		this.#tokenBatcher ??= new TokenBatcher(this.client, this.baseToken);
		return {
			get: async (tokenPublicKey: string, flushNow?: boolean) => {
				const token = await this.#tokenBatcher!.get(tokenPublicKey);
				if (flushNow) {
					this.#tokenBatcher!.flushNow();
				}
				return({ token });
			}
		}
	}
}
