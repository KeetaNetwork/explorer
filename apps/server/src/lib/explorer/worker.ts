import { Hono, type Context } from "hono";
import { Explorer, type ExplorerConfig } from ".";
import { cors } from "hono/cors";
import { createMiddleware } from "hono/factory";
import api from "@/api";
import { logger } from "hono/logger";
import { Network } from "../network";
import { KeetaNetLib } from "@/utils/keetanet";
import { getNetworkConfigFromRequest } from "@/utils/request";
import { CustomNetwork } from "../network/custom";
import { createHash } from 'crypto';
import { NotFoundError } from "@/api/errors";

export interface ExplorerWorkerConfig extends ExplorerConfig {
    /**
     * Version of the worker
     */
    version: string;
}

export interface WorkerEnv {
	Variables: {
		explorer: Explorer
	}
}

export class ExplorerWorker extends Explorer {
    #config: ExplorerWorkerConfig;

    #app: Hono;

    constructor({ version, ...config }: ExplorerWorkerConfig) {
        // Call the parent constructor
        super(config);

        // Normalize the version
        const normalizedVersion = this.#normalizeVersion(version);

        // Create the Hono app
        this.#app = new Hono()
		this.#app.use(cors({ origin: '*' })) // Allow all origins for CORS
        this.#app.use(
			logger((...str) => {
				this.log.debug('Request', ...str)
			}),
		)

        // Add defaults
        this.#addDefaultMiddleware();
        this.#addDefaultErrorHandler();
        this.#addDefaultNotFoundHandler();

        // Set the config
        this.#config = { version: normalizedVersion, ...config };
    }

    /**
     * Add routes to the Hono app
     */
    addRoutes(prefix: string = '/api') {
		prefix = `${prefix}/v${this.#config.version}`
		this.log.debug('WorkerNode', '🏁 Routes prefix :', prefix)
		this.#app.route(prefix, api)
		return prefix;
	}

    /**
     * Add default middleware
     */
    #addDefaultMiddleware() {
        this.#app.use(
            createMiddleware<WorkerEnv>(async (c, next) => {
				// Clone the explorer instance for each request
				const newInstance = cloneExplorerInstanceFromRequest(this, c);
				
				// Set the new instance in the context
				c.set('explorer', newInstance)

				newInstance.log.debug('Client Stats', `<-- ${JSON.stringify(newInstance.keetaNet.network.client.stats)}`);

				// Continue to the next middleware
                await next();

				newInstance.log.debug('Client Stats', `--> ${JSON.stringify(newInstance.keetaNet.network.client.stats)}`);
            })
        );
    }

    /**
     * Add default error handler
     */
    #addDefaultErrorHandler() {
        this.#app.onError((error, c) => {
			if (KeetaNetLib.lib.Error.isInstance(error) || error.message.toLowerCase().startsWith('required') || error.message.toLowerCase().includes('not found')) {
				return c.json({ message: error.message }, 404);
			} else if (error instanceof NotFoundError) {
				return c.json({ message: error.message }, 404);
			}
            this.log.error('ExplorerWorker', '🚨 Error:', error);
            return c.json({ message: error?.message ?? 'Internal Server Error' }, 500);
        });
    }

    /**
     * Add default not found handler
     */
    #addDefaultNotFoundHandler() {
        this.#app.notFound((c) => {
            this.log.debug('ExplorerWorker', `🚨 Not Found: ${c.req.path}`);
            return c.text('Not Found', 404);
        });
    }

    /**
     * Normalizes the version number
     */
    #normalizeVersion(version: string) {
        this.log.debug('WorkerNode', '🏁 Version :', version)
		version = version.split('.')[0]
		if (isNaN(Number(version))) {
			this.log.error('WorkerNode', '🚨 Invalid version number')
			throw new Error('Invalid version number')
		}
		if (Number(version) < 1) {
			this.log.error('WorkerNode', '🚨 Version number must be greater than 1')
			throw new Error('Version number must be greater than 1')
		}
		return version;
    }

	get app() {
		return this.#app
	}
}

const networkInstances = new Map<string, Network>();

export function cloneExplorerInstanceFromRequest(explorer: Explorer, c: Context<WorkerEnv>): Explorer {
	// Get the network configuration from the request
	const networkConfig = getNetworkConfigFromRequest(c.req) ?? { networkAlias: explorer.config.network.defaultNetwork };
	
	let network: Network | undefined = undefined;
	
	// Check if the network configuration is different from the default network
	if (networkConfig.networkAlias !== explorer.keetaNet.network.networkAlias || 'host' in networkConfig) {
		
		// Create a unique hash for the network configuration
		const hash = createHash('sha256').update(JSON.stringify(networkConfig)).digest('hex');
		
		// Check if the network instance already exists
		if (networkInstances.has(hash)) {
			explorer.log.debug('ExplorerWorker', '🏁 Reusing existing network instance for hash:', hash);
			network = networkInstances.get(hash)!;
		} else
		
		// Create a custom network instance based on the configuration
		if ('host' in networkConfig && networkConfig.host) {
			explorer.log.debug('ExplorerWorker', '🏁 Creating instance for Custom Network:', networkConfig);
			network = CustomNetwork.fromConfig(networkConfig, explorer);
			networkInstances.set(hash, network);
		}
		
		// Create a network instance from the alias
		else {
			explorer.log.debug('ExplorerWorker', '🏁 Creating instance for Network Alias:', networkConfig.networkAlias);
			network = Network.fromAlias(networkConfig.networkAlias, explorer);
			networkInstances.set(hash, network);
		}
	}
	
	// If the network configuration is the same as the default network, reuse the existing instance
	else {
		explorer.log.debug('ExplorerWorker', '🏁 Reusing existing default network instance:', explorer.keetaNet.network.networkAlias);
	}
	
	return explorer.copy(network)
}