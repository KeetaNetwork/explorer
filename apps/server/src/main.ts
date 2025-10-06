import type { Networks } from "./lib/explorer";
import { ExplorerServer } from "./lib/explorer/server";
import { assertLogLevels } from "./lib/logger/types";
import { assertNetworkAlias } from "./lib/network";
import { performance } from "node:perf_hooks";

performance.mark("boot:start");

function main() {
	/**
	 * Get the network aliases from the environment variables.
	 */
	const networksAvailable = process.env.APP_NETWORKS?.split(',') as Networks[] | undefined;
	if (networksAvailable && networksAvailable.length > 0) {
		for (const networkAlias of networksAvailable) {
			assertNetworkAlias(networkAlias, `[main] Invalid network alias in APP_NETWORKS: "${networkAlias}"`);
		}
	}

	/**
	 * Get the default network from the environment variables.
	 */
	const defaultNetwork = process.env.APP_DEFAULT_NETWORK ?? 'test';
	assertNetworkAlias(defaultNetwork, `[main] Invalid default network alias: "${defaultNetwork}"`);

	/**
	 * Get the log level from the environment variables.
	 */
	const logLevel = (process.env.APP_LOG_LEVEL ?? 'WARN');
	assertLogLevels(logLevel, `[main] Invalid log level: "${logLevel}"`);

	/**
	 * Get the listen port from the environment variables.
	 */
	const listenPort = process.env.APP_LISTEN_PORT ? parseInt(process.env.APP_LISTEN_PORT) : 8080;
	if (isNaN(listenPort) || listenPort < 1 || listenPort > 65535) {
		throw new Error(`[main] Invalid listen port: ${listenPort}`);
	}

	/**
	 * Get the listen IP from the environment variables.
	 */
	const listenIP = process.env.APP_LISTEN_IP ?? '0.0.0.0';

	/**
	 * Start the websocket server.
	 */
	const startWebSocketServer = process.env.APP_START_WS_SERVER ? process.env.APP_START_WS_SERVER === 'true' : true;

	return ExplorerServer.main({
		listenPort,
		listenIP,
		startWebSocketServer,
		version: '1.0.0',
		logLevel: logLevel,

		network: {
			networksAvailable,
			defaultNetwork,
		}
	})
}

main();
