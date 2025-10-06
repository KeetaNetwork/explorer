import * as components from '@keetanetwork/pulumi-components';
import * as gcp from '@pulumi/gcp';
import * as pulumi from '@pulumi/pulumi';
import * as path from 'path';

import type { ConfigRegion } from './network';
import type { ServiceType } from './service';
import { generateName, getPrefixHash } from './utils';

const buildTargets = ['server-runner'] as const;
type BuildTarget = typeof buildTargets[number];

type ServiceImageType = Exclude<ServiceType, 'websocket' | 'web'>

type DockerRemoteImageArgs = Extract<ConstructorParameters<typeof components.docker.DockerImage>[1], { bucket: any }>;

type ConfigImageBuild = {
	/**
	 * The directory to use for the Docker image build
	 */
	directory?: string;

	/**
	 * The GitHub SHA to use as the version for the Docker image
	 */
	githubSha?: string;

	/**
	 * Docker options for the remote image
	 */
	dockerOptions?: Pick<DockerRemoteImageArgs, 'serviceAccount' | 'bucket' | 'provider' | 'registryUrl'>;
}

type ConfigImageArgValue = Record<string, pulumi.Input<string>>;

type ConfigImageRemote = Partial<Pick<Parameters<components.docker.RemoteDockerImage['_checkImage']>[2], 'serviceAccount' | 'bucket' | 'bindPermissions'>> & {
	bucketConfig?: Partial<Pick<ConstructorParameters<typeof gcp.storage.Bucket>[1], 'logging'>>;
};

export type ConfigImage = {
	/**
	 * The URL of the Docker registry to use
	 */
	registryUrl?: string;

	/**
	 * Configuration to use a remote Docker image build
	 */
	remote?: ConfigImageRemote;

	/**
	 * The build configuration for the Docker image
	 */
	build: ConfigImageBuild;

	/**
	 * Node image to use for the Docker build
	 */
	nodeImage?: string;
}

type Config = ConfigImage & {
	project: string;
	mainRegion: ConfigRegion['region'];
	deploymentName: string;
};

export class Image extends pulumi.ComponentResource {

	private name: string;
	private config: Config;

	private images: Record<ServiceImageType, components.docker.DockerImage>;
	private serviceAccount?: gcp.serviceaccount.Account;

	private buildDirectory: string;

	constructor(name: string, config: Config, opts?: pulumi.ComponentResourceOptions) {
		super('Explorer:GCP:Image', name, config, opts);

		this.name = name;
		this.config = config;

		// Set the default build directory
		const scriptDir = path.dirname(new URL(import.meta.url).pathname)
		this.buildDirectory = this.config.build.directory ?? path.join(scriptDir, '..');

		// Create the Docker image for the server service
		const server = this.createImage('server-runner', config.nodeImage);

		this.images = { server };
	}

	/**
	 * Create a Docker image for the given build target
	 */
	private createImage(buildTarget: BuildTarget, nodeImage?: string) {
		const buildArgs: ConfigImageArgValue = {}

		if (nodeImage) {
			buildArgs['NODE_IMAGE'] = nodeImage;
		}

		let imageConfig: ConstructorParameters<typeof components.docker.DockerImage>[1] = {
			versioning: this.getDockerImageVersioning(),
			imageName: components.utils.normalizeName(this.name, buildTarget),
			registryUrl: this.getRegistryUrl(),
			platform: 'linux/amd64',
			buildArgs: {
				FILE_NAME: 'server.zip',
				...buildArgs,
			},
			buildTarget,
			buildDirectory: {
				type: 'DIRECTORY',
				directory: this.buildDirectory,
			},
			...this.config.build.dockerOptions
		}

		// Get the remote configuration if available
		const remoteConfig = this.getRemoteConfig(`${this.name}-${buildTarget}`);
		if (remoteConfig) {
			imageConfig = {
				...imageConfig,
				...remoteConfig
			}
		}

		// Create the Docker image
		return new components.docker.DockerImage(`${this.name}-${buildTarget}`, imageConfig, { parent: this });
	}

	/**
	 * Get the Docker image for the given service type
	 */
	public getImageUri(serviceType: ServiceImageType): pulumi.Output<string> {
		if (!this.images[serviceType]) {
			throw new Error(`Image for service type ${serviceType} not found`);
		}

		return this.images[serviceType].uri;
	}

	/**
	 * Get the versioning configuration for the Docker image
	 */
	private getDockerImageVersioning(): NonNullable<ConstructorParameters<typeof components.docker.DockerImage>[1]>['versioning'] {
		// Use the GitHub SHA as the version if available
		if (this.config.build.githubSha) {
			return {
				type: 'PLAIN',
				value: this.config.build.githubSha,
			}
		}

		// Fallback to using the directory as the version
		return {
			type: 'FILE',
			fromFile: this.buildDirectory
		}
	}

	/**
	 * Get the remote configuration for the Docker image
	 */
	private getRemoteConfig(name: string) {
		if (!this.config.remote) {
			return undefined;
		}

		// Create the GCP provider
		const provider = new gcp.Provider(`${name}-provider`, {
			project: this.config.project,
			region: this.config.mainRegion
		}, { parent: this });

		let { bindPermissions, serviceAccount, bucket } = this.config.remote;

		// If no remote config options are specified, default to binding permissions
		if (bindPermissions === undefined && (serviceAccount === undefined || bucket === undefined)) {
			bindPermissions = true;
		}

		// If no service account is specified, create a new one
		if (!serviceAccount) {
			if(!this.serviceAccount) {
				this.serviceAccount = new gcp.serviceaccount.Account(`${this.name}-service-account`, {
					accountId: `${getPrefixHash(this.config.deploymentName, 10)}-docker-ee`
				}, { parent: this });
			}
			serviceAccount = this.serviceAccount;
		}

		// If no bucket is specified, create a new one
		if (!bucket) {
			bucket = new gcp.storage.Bucket(generateName(name, 'docker', 55), {
				location: this.config.mainRegion,
				forceDestroy: true,
				uniformBucketLevelAccess: true,
				...this.config.remote.bucketConfig
			}, { parent: this });
		} else if (gcp.storage.Bucket.isInstance(bucket)) {
			pulumi.output(bucket.forceDestroy).apply(function(forceDestroy) {
				if (!forceDestroy) {
					console.debug('Explorer Image bucket should have forceDestroy set to true to avoid issues with remote docker image');
				}
			});
		}

		return {
			provider,
			bindPermissions,
			serviceAccount,
			bucket,
		};
	}

	/**
	 * Get the registry URL for the Docker image
	 */
	private getRegistryUrl() {
		if (!this.config.registryUrl) {
			if (!this.config.project) {
				throw new Error('No project specified, could not get default registry URL');
			}
			// Default to the GCP Artifact Registry URL
			return `${this.config.mainRegion}-docker.pkg.dev/${this.config.project}/keeta`;
		}

		return this.config.registryUrl;
	}
}
