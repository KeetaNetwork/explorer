import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import type { GCPRegion } from '@keetanetwork/pulumi-components/dist/packages/gcp/constants';

export type ConfigRegion = {
	region: GCPRegion
	isMain?: true
}

export type ConfigNetwork = {
	/**
	 * GCP project
	 */
	project: string;

	/**
	 * GCP regions
	 *
	 * When there is only one region, it will be the main region by default.
	 */
	regions: [ConfigRegion, ...ConfigRegion[]];
}

export type NetworkVPCConnectors = Partial<Record<ConfigRegion['region'], gcp.vpcaccess.Connector>>;

export class Network extends pulumi.ComponentResource {

	private config: ConfigNetwork;

	constructor(name: string, config: ConfigNetwork, opts?: pulumi.ComponentResourceOptions) {
		super('Explorer:GCP:Network', name, config, opts);
		this.config = config;
	}

	/**
	 * Get the main region for the deployment
	 */
	public getMainRegion() {
		if (this.config.regions.length === 1) {
			return this.config.regions[0].region;
		}

		const mainRegion = this.config.regions.find(region => region.isMain);
		if (!mainRegion) {
			throw new Error('No main region found');
		}

		return mainRegion.region;
	}
}
