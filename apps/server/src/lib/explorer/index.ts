import type { DeepRequired } from "@/utils/types";
import { KeetaNet } from "../keetanet";
import { Logger } from "../logger";
import { LogLevels } from "../logger/types";
import { Network } from "../network";
import type { KeetaNetLib } from "@/utils/keetanet";

export type Networks = typeof KeetaNetLib.Client.Config.networksArray[number]

export interface ExplorerConfig {
	/**
	 * Logging level
	 * - debug: all messages
	 * - error: only error messages
	 */
	logLevel?: LogLevels

	/**
	 * Network configuration
	 */
	network: {
		/**
		 * Networks available
		 */
		networksAvailable?: Networks[]

		/**
		 * Default Netowkr
		 */
		defaultNetwork: Networks
	}
}

export class Explorer {
    config: DeepRequired<ExplorerConfig>
    
	log: Logger
	
	keetaNet: KeetaNet

    constructor(configOrInstance: ExplorerConfig | Explorer, network?: Network) {
        if (configOrInstance instanceof Explorer) {
            const instance = configOrInstance;
            this.log = instance.log;
            this.config = instance.config;
			this.keetaNet = instance.keetaNet.copy(network);
            return;
        }

        const config = { ...configOrInstance }

		const networksAvailable = config.network.networksAvailable ?? [];
		if (networksAvailable.length === 0) {
			config.network.networksAvailable = [config.network.defaultNetwork]
		} else if (networksAvailable.includes(config.network.defaultNetwork) === false) {
			throw new Error(`Default network ${config.network.defaultNetwork} is not included in the available networks: ${networksAvailable.join(', ')}`);
		}

		const logLevel = config.logLevel ?? LogLevels.WARN;
        
		this.log = new Logger(logLevel);
		this.keetaNet = new KeetaNet(network ?? Network.fromAlias(config.network.defaultNetwork, this))
        
		this.config = {
			...config,
			logLevel,
			network: {
				...config.network,
				networksAvailable,
			},
		};
    }

    /**
     * Creates a new instance of the explorer with the same configuration.
     */
    copy(network?: Network) {
		return new Explorer(this, network)
	}

    /**
     * Starts the explorer.
     */
    async run() {
		this.log.debug('Explorer', '🏁 Running ...')
	}

    async stop() {
		await this.sync()

		this.log.debug('Explorer', '🚨 Stopping explorer')
		await this.keetaNet.destroy()
	}

	async sync() {
		this.log.debug('Explorer', '🛜 Syncing explorer')
	}

    /**
     * Runs the explorer with the given configuration.
     */
    static main(config: ExplorerConfig) {
		let isShuttingDown = false;
		const shutdown = async function(signal: string, code = 0) {
			if (isShuttingDown) return;
			isShuttingDown = true;

			try {
				instance.log.debug('main', `Received "${signal}". Exiting...`);
				await instance.stop();
				instance.log.debug('main', 'Exited successfully');
				process.exit(code);
			} catch (err) {
				instance.log.error('main', `Error while stopping on "${signal}":`, err);
				process.exit(1);
			}
		}

        const instance = new this(config)
		instance.run().then(() => process.exit(0)).catch(error => {
			instance.log.error('main', 'Error while running:', error)
			shutdown('run error', 1);
		})

		process.on('SIGINT', () => shutdown('SIGINT', 0));
		process.on('SIGQUIT', () => shutdown('SIGQUIT', 0));
		process.on('SIGTERM', () => shutdown('SIGTERM', 0));

		process.on('exit', code => {
			instance.log[code === 0 ? 'debug' : 'error']('main', `Exiting with code: ${code}`)
		})

		process.on('uncaughtException', error => {
			instance.log.error('main', 'Uncaught exception', error)
			shutdown('uncaughtException', 1);
		})

		process.on('unhandledRejection', (reason, promise) => {
			instance.log.error('main', 'Unhandled rejection at:', promise, 'reason:', reason);
			shutdown('unhandledRejection', 1);
		})
    }
}