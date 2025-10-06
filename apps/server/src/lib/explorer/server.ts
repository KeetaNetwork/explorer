import { serve, type ServerType } from '@hono/node-server';
import { ExplorerWorker, type ExplorerWorkerConfig } from "./worker";
import { createNodeWebSocket } from '@hono/node-ws';
import { websocketEndpoint } from '@/api/websocket';
import { performance } from 'node:perf_hooks';

interface ExplorerServerConfig extends ExplorerWorkerConfig {
    listenPort: number;
    listenIP: string;
	startWebSocketServer?: boolean;
}

export class ExplorerServer extends ExplorerWorker {
    #config: ExplorerServerConfig;

    constructor(config: ExplorerServerConfig) {
        // Call the parent constructor
        super(config);

        // Set the config
		this.#config = config;
    }

    async run() {
		const { startWebSocketServer = true } = this.#config;

        await super.run();

        /**
		 * Add routes
		 */
		const prefix = this.addRoutes();

		/**
         * Add the websocket route
         */
		let injectWebSocketServer: ReturnType<typeof createNodeWebSocket>['injectWebSocket'] | undefined;
		if (startWebSocketServer) {
			const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app: this.app})
			injectWebSocketServer = injectWebSocket;
			this.app.get(`${prefix}/ws`, upgradeWebSocket(c => websocketEndpoint(c)))
		}

        /**
         * Create the server
         */
        const server: ServerType = await new Promise((resolve) => {
            const serverListening = serve({
                fetch: super.app.fetch,
                port: this.#config.listenPort,
                hostname: this.#config.listenIP,
            }, (info) => {
                this.log.debug('ExplorerServer', `Server is running on http://${info.address}:${info.port}`)
                resolve(serverListening);
            })
        })

        /**
         * Create the websocket server
         */
		if (startWebSocketServer) {
			injectWebSocketServer?.(server);
			this.log.debug('ExplorerServer', 'WebSocket server started');
		}

		performance.mark("boot:ready");

		performance.measure('boot', 'boot:start', 'boot:ready');
		const [m] = performance.getEntriesByName('boot');
		this.log.debug('BOOT', m.duration.toFixed(0), 'ms');
        /**
		 * Wait for the server to shutdown, handling connections in the background
		 */
		const promise = new Promise(function(resolve) {
			server.on('close', function() {
				resolve(null);
			});
		});

		await promise;     
    }

	static main(config: ExplorerServerConfig) {
		super.main(config);
	}
}