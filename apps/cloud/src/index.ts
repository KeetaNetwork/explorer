import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import type { ConfigImage } from './lib/image';
import { Image } from './lib/image';
import type { ConfigLoadBalancer } from './lib/load-balancer';
import { LoadBalancer } from './lib/load-balancer';
import type { ConfigNetwork } from './lib/network';
import { Network } from './lib/network';
import type { ConfigAuthentication, ConfigService } from './lib/service';
import { Service } from './lib/service';
import { Web } from './lib/web';

export type Networks = 'main' | 'staging' | 'test' | 'dev';

export type ConfigExplorerDeployment = {
	/**
	 * Deployment name
	 */
	deploymentName: string;

	/**
	 * GCP Network configuration
	 */
	network: ConfigNetwork;

	/**
	 * Docker Image configuration
	 */
	image: ConfigImage;

	/**
	 * Authentication configuration
	 * Use this to enable OAuth2 authentication for the services
	 */
	authentication?: ConfigAuthentication;

	/**
	 * Services configuration
	 */
	services: {
		/**
		 * Server public URL
		 */
		serverUrl: string

		/**
		 * Default network to use
		 */
		defaultNetwork: Networks;

		/**
		 * Available networks
		 */
		availableNetworks?: Networks[];

		/**
		 * Listen port
		 */
		listenPort?: number;

		/**
		 * Listen IP
		 */
		listenIP?: string;

		/**
		 * Log level
		 */
		logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'NONE';

		/**
		 * Server service configuration
		 */
		server?: ConfigService;

		/**
		 * Web service configuration
		 */
		web?: ConfigService;
	};

	/**
	 * Load balancer configuration
	 *
	 * @example
	 * const configLoadBalancer = {
	 * 	sslCertificates: ['certificate-name-here']
	 * }
	 */
	loadBalancer: ConfigLoadBalancer;
};

export class ExplorerDeployment extends pulumi.ComponentResource {

	private name: string;
	private config: ConfigExplorerDeployment;

	private provider: gcp.Provider;

	public ips: pulumi.Output<string[]> | undefined;

	constructor(name: string, config: ConfigExplorerDeployment, opts?: pulumi.ComponentResourceOptions) {
		super('Explorer:GCP:Deploy', name, config, opts);

		this.name = name;
		this.config = config;

		// Create a GCP provider
		this.provider = new gcp.Provider(`${this.name}-provider`, {
			project: this.config.network.project,
		}, { parent: this });

		// Validate the configuration
		this.validate();

		// Execute the deployment
		this.run();

		this.registerOutputs({
			ips: this.ips,
		})
	}

	/**
	 * Validate the configuration
	 */
	private validate() {
		if (this.config.network.regions.length === 0) {
			throw new Error('At least one region must be specified');
		}
	}

	/**
	 * Run the deployment
	 */
	private run() {
		/**
		 * Create the network
		 */
		const network = new Network(`${this.name}-net`, this.config.network, { provider: this.provider });

		/**
		 * Regions
		 */
		const regions = this.config.network.regions.map(function(region) {
			return(region.region);
		});

		/**
		 * Create the Docker image
		 */
		const image = new Image(`${this.name}-image`, {
			...this.config.image,
			deploymentName: this.config.deploymentName,
			project: this.config.network.project,
			mainRegion: network.getMainRegion(),
		}, { provider: this.provider });

		const commonEnvs = {
			APP_DEFAULT_NETWORK: this.config.services.defaultNetwork,
			...(this.config.services.availableNetworks ? { APP_NETWORKS: this.config.services.availableNetworks.join(',') } : {}),
			...(this.config.services.listenIP ? { APP_LISTEN_IP: this.config.services.listenIP } : {}),
			...(this.config.services.listenPort ? { APP_LISTEN_PORT: String(this.config.services.listenPort) } : {}),
			...(this.config.services.logLevel ? { APP_LOG_LEVEL: this.config.services.logLevel } : {}),
			...this.config.services?.server?.environmentVariables,
		}

		/**
		 * Create the server service
		 */
		const serverService = new Service(`${this.name}-service-server`, {
			...this.config.services?.server,
			probe: { endpoint: '/api/v1/network/stats' },
			authentication: this.config.authentication,
			spec: {
				cpuLimit: 2,
				memoryLimit: 512,
				...this.config.services?.server?.spec,
			},
			type: 'server',
			image: image.getImageUri('server'),
			regions: regions,
			environmentVariables: {
				...commonEnvs,
				APP_START_WS_SERVER: 'false',
			}
		}, { provider: this.provider });

		/**
		 * Create the websocket server service
		 */
		const websocketService = new Service(`${this.name}-websocket-server`, {
			...this.config.services?.server,
			authentication: this.config.authentication,
			spec: {
				cpuLimit: 1,
				memoryLimit: 512,
				...this.config.services?.server?.spec,
			},
			type: 'websocket',
			image: image.getImageUri('server'),
			regions: regions,
			metadataAnnotations: {
				'run.googleapis.com/cpu-throttle': 'false',
			},
			environmentVariables: {
				...commonEnvs,
				APP_START_WS_SERVER: 'true',
			}
		}, { provider: this.provider });

		/**
		 * Create the web service
		 */
		const web = new Web(`${this.name}-web`, {
			defaultNetwork: this.config.services.defaultNetwork,
			availableNetworks: this.config.services.availableNetworks ?? [this.config.services.defaultNetwork],
			serverUrl: this.config.services.serverUrl,
		}, { provider: this.provider });

		/**
		 * Create the load balancer
		 */
		const loadBalancer = new LoadBalancer(`${this.name}-lb`, {
			...this.config.loadBalancer,
			services: {
				api: serverService.backendService.id,
				ws: websocketService.backendService.id,
				web: web.backendBucket.id,
			}
		}, { provider: this.provider });

		// Export the IP addresses of the load balancer
		this.ips = loadBalancer.ips;
	}
}
