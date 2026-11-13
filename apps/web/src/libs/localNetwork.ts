import * as v from "valibot";
import * as Anchor from "@keetanetwork/anchor";
import type { Networks as NetworkAlias } from "@keetanetwork/keetanet-client/config";

const KeetaNetLib = Anchor.KeetaNet;

/**
 * A local KeetaNet network, for development only: representatives on this
 * machine that serve a network alias (the local network uses the test
 * network's) in place of the public ones. Set `VITE_APP_LOCAL_NETWORK` to
 * its endpoints.json (scripts/start-dev-server.ts does, given
 * KEETA_LOCAL_NETWORK); production builds ignore it.
 *
 * Contracts exist only on such networks, so contract views are shown only
 * with one.
 */
const localNetworkSchema = v.object({
	network: v.union([v.string(), v.number()]),
	networkAlias: v.string(),
	representatives: v.pipe(v.array(v.object({
		key: v.string(),
		api: v.string(),
		p2p: v.string()
	})), v.minLength(1))
});

export type LocalNetwork = {
	networkAlias: NetworkAlias;
	network: bigint;
	representatives: { key: string, api: string, p2p: string }[];
};

function readLocalNetwork(): LocalNetwork | null {
	if (!import.meta.env.DEV) {
		return(null);
	}

	const raw = import.meta.env.VITE_APP_LOCAL_NETWORK as string | undefined;
	if (!raw) {
		return(null);
	}

	try {
		const parsed = v.parse(localNetworkSchema, JSON.parse(raw));
		if (!KeetaNetLib.UserClient.Config.isNetwork(parsed.networkAlias)) {
			throw(new Error(`Unknown network alias "${parsed.networkAlias}"`));
		}
		return({ ...parsed, networkAlias: parsed.networkAlias, network: BigInt(parsed.network) });
	} catch (error) {
		console.error('Ignoring VITE_APP_LOCAL_NETWORK, which is not a local network\'s endpoints:', error);
		return(null);
	}
}

export const localNetwork = readLocalNetwork();

/** Whether contract views are shown: only with a local network, in development */
export const contractsEnabled = localNetwork !== null;

/**
 * A client for the local network, if it serves this alias
 */
export function localNetworkClientFor(networkAlias: NetworkAlias): InstanceType<typeof KeetaNetLib.UserClient> | null {
	if (!localNetwork || localNetwork.networkAlias !== networkAlias) {
		return(null);
	}

	const client = new KeetaNetLib.Client(localNetwork.representatives.map(({ key, api, p2p }) => ({
		key: KeetaNetLib.lib.Account.fromPublicKeyString(key).assertAccount(),
		endpoints: { api, p2p }
	})));

	return(new KeetaNetLib.UserClient({
		client,
		signer: null,
		network: localNetwork.network,
		networkAlias
	}));
}
