import { assertNetworkAlias, type NetworkConfig } from "@/lib/network";
import type { HonoRequest } from "hono";

export function createHeaderFromNetworkConfig(config: NetworkConfig) {
	if (!config.networkAlias) {
		throw(new Error('Network alias is required to create headers'));
	}

	const headers: Record<string, string> = {
		'x-network-alias': config.networkAlias
	};

	if (!('host' in config)) {
		return headers;
	}

	if (config.host) {
		headers['x-network-host'] = config.host;
	}

	if (config.ssl !== undefined) {
		headers['x-network-ssl'] = config.ssl ? 'true' : 'false';
	}

	if (config.repKey) {
		headers['x-network-rep-key'] = config.repKey;
	}

	return headers;
}

export function getNetworkConfigFromRequest(req: HonoRequest) {	
	const networkAlias = req.header('x-network-alias') ?? req.query('networkAlias');
	if (!networkAlias) {
		return undefined;
	}

	assertNetworkAlias(networkAlias);

	const urlHost = req.header('x-network-host') ?? req.query('host');
	const urlSSL = req.header('x-network-ssl') ?? req.query('ssl');
	const urlRepKey = req.header('x-network-rep-key') ?? req.query('repKey');

	if (!urlHost) {
		return({ networkAlias });
	}

	return({
		networkAlias,
		host: urlHost,
		ssl: !urlSSL || urlSSL === 'true',
		repKey: urlRepKey ?? undefined
	});
}

export function getNetworkConfigFromQuery(query: Record<string, string | undefined>): NetworkConfig | undefined {
	const networkAlias = query.networkAlias;
	if (!networkAlias) {
		return undefined;
	}
	
	assertNetworkAlias(networkAlias);

	const host = query.host;
	const ssl = query.ssl;
	const repKey = query.repKey;
	
	if (!host) {
		return({ networkAlias });
	}

	return({
		networkAlias,
		host,
		ssl: ssl ? ssl === 'true' : true,
		repKey: repKey ?? undefined
	});
}