import { KeetaNetLib } from "@/utils/keetanet";
import type { KeetaNetAccount, KeetaNetIdentifier } from '.';
import { Network } from '.';
import type { Explorer } from '../explorer';

type NetworkAlias = ReturnType<typeof KeetaNetLib.lib.Node.getDefaultConfig>['networkAlias']
type KeetaNetClient = ReturnType<typeof KeetaNetLib.Client.fromNetwork>

/**
 * Custom Client
 */
export type CustomNetworkConfig = {
	networkAlias: NetworkAlias;
	host: string;
	ssl: boolean;
	repKey?: string;
};

export class CustomNetwork extends Network {
	readonly config: CustomNetworkConfig;

	constructor(networkClient: KeetaNetClient, networkAlias: NetworkAlias, networkId: string, config: CustomNetworkConfig, explorer: Explorer) {
		super(networkClient, networkAlias, networkId, explorer);
		this.config = config;
	}

	static fromConfig(config: CustomNetworkConfig, explorer: Explorer): CustomNetwork {
		const { networkAlias, ssl, host, repKey } = config;
		const key = repKey
			? KeetaNetLib.lib.Account.fromPublicKeyString(repKey)
			: KeetaNetLib.Client.fromNetwork(networkAlias).representatives[0].key;

		const networkClient = new KeetaNetLib.Client([{
			key: key.assertAccount(),
			endpoints: {
				api: `http${ssl ? 's' : ''}://${host}/api`,
				p2p: `ws${ssl ? 's' : ''}://${host}/p2p`
			}
		}]);

		const { network } = KeetaNetLib.lib.Node.getDefaultConfig(networkAlias);

		return(new CustomNetwork(networkClient, networkAlias, network.toString(), { ...config, repKey: key.publicKeyString.toString() }, explorer));
	}

	static isInstance(value: unknown): value is CustomNetwork {
		return(value instanceof CustomNetwork);
	}

	getUserClient(account: KeetaNetAccount | KeetaNetIdentifier) {
		const { host, ssl, repKey, networkAlias } = this.config;
		if (!repKey) {
			throw(new Error(`Representative key not found for network ${this.networkAlias}`));
		}

		const userClient = KeetaNetLib.UserClient.fromSimpleSingleRep(host, ssl, repKey, BigInt(this.networkId), networkAlias, null, { account });
		return(userClient);
	}
}
