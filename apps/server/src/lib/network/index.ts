import { KeetaNetLib } from "@/utils/keetanet";
import type { Explorer } from '../explorer';
import type { CustomNetworkConfig } from './custom';

export type NetworkAlias = ReturnType<typeof KeetaNetLib.lib.Node.getDefaultConfig>['networkAlias']
const isNetwork = KeetaNetLib.UserClient.Config.isNetwork;

export function assertNetworkAlias(value: unknown, message?: string): asserts value is NetworkAlias {
	if (!isNetwork(value)) {
		throw(new Error(message ?? `Invalid network alias: ${String(value)}`));
	}
}

export type NetworkDetails = {
	networkAlias: NetworkAlias;
};

export type NetworkConfig = NetworkDetails | CustomNetworkConfig;

export type KeetaNetGenericAccount = NonNullable<ReturnType<typeof KeetaNetLib.lib.Account.toAccount>>;
export type KeetaNetAccount = ReturnType<KeetaNetGenericAccount['assertAccount']>;
export type KeetaNetIdentifier = ReturnType<KeetaNetGenericAccount['assertIdentifier']>;

type KeetaNetClient = ReturnType<typeof KeetaNetLib.Client.fromNetwork>

/**
 * Network
 */
export class Network {
	#client?: KeetaNetClient;

	readonly networkAlias: NetworkAlias;
	readonly networkId: string;
	readonly explorer: Explorer;

	constructor(networkClient: KeetaNetClient, networkAlias: NetworkAlias, networkId: string, explorer: Explorer) {
		this.#client = networkClient;
		this.networkAlias = networkAlias;
		this.networkId = networkId;
		this.explorer = explorer;
	}

	static fromAlias(networkAlias: NetworkAlias, explorer: Explorer): Network {
		const { network } = KeetaNetLib.lib.Node.getDefaultConfig(networkAlias);
		const networkClient = KeetaNetLib.Client.fromNetwork(networkAlias);
		return(new Network(networkClient, networkAlias, network.toString(), explorer));
	}

	copy(): Network {
		const client = KeetaNetLib.Client.fromNetwork(this.networkAlias);
		return(new Network(client, this.networkAlias, this.networkId, this.explorer));
	}

	getBaseToken() {
		const { baseToken } = KeetaNetLib.lib.Account.generateBaseAddresses(BigInt(this.networkId));
		return(baseToken.assertKeyType(KeetaNetLib.lib.Account.AccountKeyAlgorithm.TOKEN));
	}

	getUserClient(account: KeetaNetAccount | KeetaNetIdentifier) {
		const userClient = new KeetaNetLib.UserClient({
			client: this.client,
			signer: null,
			account: account,
			network: BigInt(this.networkId),
			networkAlias: this.networkAlias
		});
		return(userClient);
	}

	get keetanetNetworkAddress() {
		if (this.networkId === undefined) {
			throw(new Error('keetanetNetworkID not set'));
		}
		return(KeetaNetLib.lib.Account.generateNetworkAddress(BigInt(this.networkId)));
	}

	get client() {
		if (!this.#client) {
			throw(new Error('Network client not set'));
		}
		return(this.#client);
	}

	get initialTrustedAccount(): KeetaNetAccount | undefined {
		throw(new Error(`Initial trusted account not implemented for network: ${this.networkAlias}`));
	}

	get demoAccountSeed(): string | undefined {
		throw(new Error(`Demo account seed not implemented for network: ${this.networkAlias}`));
	}

	async listNetworks(): Promise<NetworkDetails[]> {
		return(this.explorer.config.network.networksAvailable.map(function(networkAlias) {
			return({ networkAlias });
		}));
	}

	// Clean up resources
	async destroy() {
		if (this.#client) {
			await this.#client.destroy();
			this.#client = undefined;
		}
	}

	static getDefaultConfig(networkAlias: NetworkAlias): { rootCA: string } {
		switch (networkAlias) {
			case 'test':
				return {
					rootCA: `-----BEGIN CERTIFICATE-----
MIIBiDCCAS2gAwIBAgIGAZhi7awAMAsGCWCGSAFlAwQDCjApMScwJQYDVQQDEx5L
ZWV0YSBUZXN0IE5ldHdvcmsgS1lDIFJvb3QgQ0EwHhcNMjUwODAxMDAwMDAwWhcN
MjgwODAxMDAwMDAwWjApMScwJQYDVQQDEx5LZWV0YSBUZXN0IE5ldHdvcmsgS1lD
IFJvb3QgQ0EwNjAQBgcqhkjOPQIBBgUrgQQACgMiAAKK1O9NiYvu2sBYNRPfjOpp
sNSMZ1lOVn+psFdk3Ugq2qNjMGEwDwYDVR0TAQH/BAUwAwEB/zAOBgNVHQ8BAf8E
BAMCAMYwHwYDVR0jBBgwFoAUap82oKFjJ2jhIj2CGABULiX4h3owHQYDVR0OBBYE
FGqfNqChYydo4SI9ghgAVC4l+Id6MAsGCWCGSAFlAwQDCgNIADBFAiEAqnl85S6v
bw8HLO+YXhnwqq6GmnY+7tCcnwYtoyDzYTMCIEw7ALqHJp0kO9AExm5sSoC7rPOd
GlX42GsZQW3AJ7Jc
-----END CERTIFICATE-----`,
				}
			default: {
				return { rootCA: "" };
			}
		}
	}
}