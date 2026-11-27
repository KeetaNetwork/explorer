/**
 * A local KeetaNet network, for development: representatives running on
 * this machine (such as those `utils/local-network.mjs` in the node starts),
 * described by the `endpoints.json` it writes.
 *
 * It takes the place of the network whose alias it uses (the local network
 * uses the test network's ID and alias), so only use it in development.
 */
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { KeetaNetLib } from '@/utils/keetanet';
import { assertNetworkAlias, Network, type NetworkAlias } from '.';
import type { Explorer } from '../explorer';

type KeetaNetClient = InstanceType<typeof KeetaNetLib.Client>;

const endpointsSchema = v.object({
	network: v.union([v.string(), v.number()]),
	networkAlias: v.string(),
	representatives: v.pipe(v.array(v.object({
		key: v.pipe(v.string(), v.startsWith('keeta_')),
		api: v.pipe(v.string(), v.url()),
		p2p: v.pipe(v.string(), v.url())
	})), v.minLength(1))
});

export type LocalNetworkConfig = {
	networkAlias: NetworkAlias;
	/** The network's ID */
	network: bigint;
	representatives: { key: string, api: string, p2p: string }[];
};

/**
 * Read a local network's description (`endpoints.json`)
 */
export function parseLocalNetworkConfig(input: unknown): LocalNetworkConfig {
	const parsed = v.parse(endpointsSchema, input);
	assertNetworkAlias(parsed.networkAlias, `[local network] Unknown network alias "${parsed.networkAlias}"`);
	return({
		networkAlias: parsed.networkAlias,
		network: BigInt(parsed.network),
		representatives: parsed.representatives.map(({ key, api, p2p }) => ({ key, api, p2p }))
	});
}

export function readLocalNetworkConfig(path: string): LocalNetworkConfig {
	let input: unknown;
	try {
		input = JSON.parse(readFileSync(path, 'utf-8'));
	} catch (error) {
		throw(new Error(`[local network] Cannot read ${path}: ${error instanceof Error ? error.message : String(error)}`));
	}
	return(parseLocalNetworkConfig(input));
}

function clientFor(config: LocalNetworkConfig): KeetaNetClient {
	return(new KeetaNetLib.Client(config.representatives.map(({ key, api, p2p }) => ({
		key: KeetaNetLib.lib.Account.fromPublicKeyString(key).assertAccount(),
		endpoints: { api, p2p }
	}))));
}

export class LocalNetwork extends Network {
	readonly config: LocalNetworkConfig;

	constructor(networkClient: KeetaNetClient, config: LocalNetworkConfig, explorer: Explorer) {
		super(networkClient, config.networkAlias, config.network.toString(), explorer);
		this.config = config;
	}

	static fromConfig(config: LocalNetworkConfig, explorer: Explorer): LocalNetwork {
		return(new LocalNetwork(clientFor(config), config, explorer));
	}

	static isInstance(value: unknown): value is LocalNetwork {
		return(value instanceof LocalNetwork);
	}

	copy(): LocalNetwork {
		return(LocalNetwork.fromConfig(this.config, this.explorer));
	}
}
