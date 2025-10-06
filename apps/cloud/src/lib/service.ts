import * as gcp from '@pulumi/gcp';
import type { BackendServiceArgs } from '@pulumi/gcp/compute/backendService';
import * as pulumi from '@pulumi/pulumi';

import type { ConfigRegion } from './network';

const serviceTypes = ['server', 'websocket'] as const;
export type ServiceType = typeof serviceTypes[number];

type ConfigServiceSpec = {
	concurrency?: number;
	timeoutSeconds?: number;
	minScale?: number;
	maxScale?: number;
	memoryLimit?: number;
	cpuLimit?: number;
}

type ConfigServiceProbe = {
	/**
	 * Endpoint to probe
	 */
	endpoint: string;

	/**
	 * HTTP headers to send with the probe
	 */
	authHeader?: pulumi.Input<string>
}

export type ConfigAuthentication = {
	/**
	 * Client ID for the OAuth2 authentication
	 */
	clientId: pulumi.Input<string>;

	/**
	 * Client Secret for the OAuth2 authentication
	 */
	clientSecret: pulumi.Input<string>;

	/**
	 * Domains to allow for the OAuth2 authentication
	 *
	 * @default ['keeta.com']
	 */
	domains?: pulumi.Input<string>[];
}

export type ConfigService = {
	/**
	 * Service specification for the Cloud Run service
	 */
	spec?: ConfigServiceSpec;

	/**
	 * GCP Backend service configuration
	 */
	backend?: Omit<BackendServiceArgs, 'backends'>;

	/**
	 * Environment variables to set in the Cloud Run service
	 */
	environmentVariables?: Record<string, pulumi.Input<string>>;
}

type Config = ConfigService & {
	probe?: ConfigServiceProbe;
	type: ServiceType;
	image: pulumi.Input<string>;
	regions: ConfigRegion['region'][];
	authentication?: ConfigAuthentication;
	metadataAnnotations?: Record<string, pulumi.Input<string>>;
}

export class Service extends pulumi.ComponentResource {

	private name: string;
	private config: Config;

	private endpointGroups: { group: pulumi.Input<string> }[] = [];
	public backendService!: gcp.compute.BackendService;

	constructor(name: string, config: Config, opts?: pulumi.ComponentResourceOptions) {
		super('Explorer:GCP:Service', name, config, opts);

		this.name = name;
		this.config = config;

		// Create a Cloud Run service in each region with the given VPC Connector
		for (const region of this.config.regions) {
			this.createService(region);
		}

		this.registerOutputs({
			backendService: this.backendService,
		});
	}

	/**
	 * Create a Cloud Run service in the given region
	 */
	private createService(region: ConfigRegion['region']) {
		let concurrency = this.config.spec?.concurrency ?? 100;
		const workerCount = Math.floor(concurrency * 2) + 1;

		let { cpuLimit, memoryLimit } = { ...this.config.spec }

		// If the CPU limit is not set, use the concurrency to calculate it
		if (cpuLimit === undefined) {
			const computedLimit = Math.max(Math.ceil(concurrency / 2), 1);
			let foundDistance = computedLimit - 1;
			for (const possibleCount of [1, 2, 4, 6, 8]) {
				const curDistance = Math.abs(possibleCount - computedLimit);
				if (curDistance <= foundDistance) {
					cpuLimit = possibleCount;
					foundDistance = curDistance;
				}
			}
		}

		// If the memory limit is not set, use the concurrency to calculate it
		if (memoryLimit === undefined) {
			memoryLimit = Math.floor(workerCount * 1024);
		}

		if (cpuLimit === undefined) {
			throw(new Error(`${this.name} Unable to determine CPU limit`));
		}

		let timeoutSeconds = this.config.spec?.timeoutSeconds ?? 60;
		let minScale = this.config.spec?.minScale ?? 1;
		let maxScale = this.config.spec?.maxScale ?? 50;

		const defaultCloudRunProbe = this.config.probe && {
			timeoutSeconds: 5,
			failureThreshold: 3,
			httpGet: {
				path: this.config.probe.endpoint,
			}
		};

		if (this.config.type === 'websocket') {
			concurrency = 1000
			minScale = 1
			maxScale = 10
			timeoutSeconds = 60 * 60 // 60 minutes
		}

		const envVars = this.config.environmentVariables ? (
			Object.entries(this.config.environmentVariables).map(([key, value]) => ({
				name: key,
				value: value
			}))
		) : [];

		const service = new gcp.cloudrun.Service(`${this.name}-${region}`, {
			location: region,
			template: {
				spec: {
					containerConcurrency: concurrency,
					timeoutSeconds,
					containers: [{
						image: this.config.image,
						envs: envVars,
						resources: {
							limits: {
								cpu: `${cpuLimit}`,
								memory: `${memoryLimit}Mi`
							}
						},
						startupProbe: defaultCloudRunProbe && {
							...defaultCloudRunProbe,
							initialDelaySeconds: 0,
							periodSeconds: 10
						},
						livenessProbe: defaultCloudRunProbe && {
							...defaultCloudRunProbe,
							initialDelaySeconds: 10,
							periodSeconds: 15
						}
					}]
				},
				metadata: {
					annotations: {
						...this.config.metadataAnnotations,

						// Min/Max scale for autoscaling
						'autoscaling.knative.dev/minScale': String(minScale),
						'autoscaling.knative.dev/maxScale': String(maxScale),
					}
				}
			},
			metadata: {
				annotations: {
					// Add this annotation to disable accessing cloud run directly from the url, it must be through load balancer
					'run.googleapis.com/ingress': 'internal-and-cloud-load-balancing'
				}
			},
			traffics: [{
				percent: 100,
				latestRevision: true
			}]
		}, {
			parent: this,
			ignoreChanges: ['metadata.annotations["run.googleapis.com/operation-id"]']
		});

		// Create a policy that allows all users to invoke the service
		this.createPolicy(service, region);

		// Create the network endpoint group for the Cloud Run service
		this.createEndpointGroup(service, region);

		// Create the backend service for the load balancer
		this.createBackendService();

		return service;
	}

	/**
	 * Create a policy that allows all users to invoke the service
	 */
	private createPolicy(service: gcp.cloudrun.Service, region: ConfigRegion['region']) {
		const iamPolicy = pulumi.output(gcp.organizations.getIAMPolicy({
			bindings: [{
				role: 'roles/run.invoker',
				members: ['allUsers']
			}]
		}, { parent: service }));

		new gcp.cloudrun.IamPolicy(`${this.name}-${region}-policy-all-users-invoke`, {
			location: service.location,
			project: service.project,
			service: service.name,
			policyData: iamPolicy.policyData
		}, { parent: service });
	}

	/**
	 * Create a network endpoint group for the Cloud Run service
	 */
	private createEndpointGroup(service: gcp.cloudrun.Service, region: ConfigRegion['region']) {
		const endpointGroup = new gcp.compute.RegionNetworkEndpointGroup(`${this.name}-endpoint-group`, {
			networkEndpointType: 'SERVERLESS',
			region,
			cloudRun: {
				service: service.name
			}
		}, { parent: service });

		this.endpointGroups.push({ group: endpointGroup.id });
	}

	/**
	 * Create the backend service for the load balancer
	 */
	private createBackendService() {
		if (this.endpointGroups.length === 0) {
			throw new Error('No endpoint groups created');
		}

		const iap = this.config.authentication && {
			oauth2ClientId: this.config.authentication.clientId,
			oauth2ClientSecret: this.config.authentication.clientSecret
		};
		const enableCdn = this.config.backend?.enableCdn ?? false;
		const backendService = new gcp.compute.BackendService(`${this.name}-backend`, {
			enableCdn,
			...this.config.backend,
			backends: this.endpointGroups,
			iap,
		}, { parent: this });

		if (this.config.authentication) {
			let members = ['domain:keeta.com'];
			if (this.config.authentication.domains) {
				members = this.config.authentication.domains.map(domain => `domain:${domain}`);
			}

			const iamPolicy = pulumi.output(gcp.organizations.getIAMPolicy({
				bindings: [{
					role: 'roles/iap.httpsResourceAccessor',
					members
				}]
			}));

			new gcp.iap.WebBackendServiceIamPolicy(`${this.name}-backend-iap-policy`, {
				policyData: iamPolicy.policyData,
				project: backendService.project,
				webBackendService: backendService.name
			}, { parent: backendService });
		}

		this.backendService = backendService;
	}
}
