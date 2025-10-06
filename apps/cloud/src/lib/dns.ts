import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { DNS as GoogleDNS } from '@google-cloud/dns';

/**
 * Configuration for managing DNS entries
 */
export type ConfigDNS = {
	/**
	 * Subdomain within the domain to use for creating records
	 */
	baseDomain: string;

	/**
	 * Default TTL for new records
	 */
	ttl?: number;
} & ({
	/**
	 * Domain Name to use to look up the hosted zone ID
	 */
	zoneDomain: string;
} | {
	/**
	 * Hosted zone ID (format will depend on DNS provider)
	 */
	zoneId: pulumi.Input<string>;
});

type Config = ConfigDNS & {
	project?: string;
};

type DNSEntry = {
	type: pulumi.Input<string>;
	name: pulumi.Input<string>;
	value: pulumi.Input<string>;
	ttl?: pulumi.Input<number>;
}

export class DNS extends pulumi.ComponentResource {

	private static instance: DNS;

	private name: string;
	private config: Config;

	private dnsZoneCache: pulumi.Output<string> | undefined;
	private dnsZoneCacheDomain: string | undefined;
	private dnsZoneCacheZoneId: pulumi.Input<string> | undefined;

	private constructor(name: string, config: Config, opts?: pulumi.ComponentResourceOptions) {
		super('Explorer:GCP:DNS', name, config, opts);

		this.name = name;
		this.config = config;

		this.setup();
	}

	/**
	 * Initialize the DNS Zone
	 */
	public static initialize(name: string, config: Config, opts?: pulumi.ComponentResourceOptions) {
		if (DNS.instance) {
			throw(new Error('DNS already initialized'));
		}

		DNS.instance = new DNS(name, config, opts);
		return DNS.instance;
	}

	/**
	 * Get the DNS instance
	 */
	public static getInstance() {
		if (!DNS.instance) {
			throw(new Error('DNS not initialized'));
		}

		return DNS.instance;
	}

	/**
	 * Setup the DNS Zone
	 */
	protected async setup() {
		if (this.dnsZoneCache === undefined) {
			if ('zoneId' in this.config) {
				this.dnsZoneCacheZoneId = this.config.zoneId;
			} else if ('zoneDomain' in this.config) {
				this.dnsZoneCacheDomain = this.config.zoneDomain;
			}

			this.dnsZoneCache = pulumi.output(this.getDNSZone(this.config));

			this.dnsZoneCache.apply(function(dnsZone) {
				console.debug('Using Managed GCP DNS Zone:', dnsZone);
			});
		} else {
			/**
			 * Ensure a compatible configuration was passed in if
			 * we are re-initialized
			 */
			if ('zoneId' in this.config) {
				const checkZoneId = this.config.zoneId;
				pulumi.all([checkZoneId, this.dnsZoneCacheZoneId]).apply(function([checkZoneIdResolved, dnsZoneCacheZoneIdResolved]) {
					if (checkZoneIdResolved !== dnsZoneCacheZoneIdResolved) {
						throw(new Error(`DNS Zone ID changed, but DNS Zone is already initialized, expected ${dnsZoneCacheZoneIdResolved}, got ${checkZoneIdResolved}`));
					}
				});
			} else if ('zoneDomain' in this.config) {
				if (this.dnsZoneCacheDomain !== this.config.zoneDomain) {
					throw(new Error(`DNS Zone Domain changed, but DNS Zone is already initialized, expected ${this.dnsZoneCacheDomain}, got ${this.config.zoneDomain}`));
				}
			}
		}
	}

	/**
	 * Set up managed DNS zone
	 */
	private async getDNSZone(config: Config) {
		if ('zoneId' in config) {
			/**
			 * Because the ZoneID is an Input, which could be a Promise, we
			 * need to disable this linting rule because we don't actually
			 * want to await the value here.
			 */
			// eslint-disable-next-line @typescript-eslint/return-await
			return(config.zoneId);
		}

		const dns = new GoogleDNS();

		const toMatchDomain = `${this.cleanDomain(config.zoneDomain)}.`;

		const [zones] = await dns.getZones({ autoPaginate: true });

		const foundZone = zones.find(function(zone) {
			return(zone.metadata.dnsName === toMatchDomain);
		});

		if (foundZone === undefined) {
			throw(new Error(`Unable to find hosted zone ID for zone ${toMatchDomain}`));
		}

		return foundZone.name;
	}

	/**
	 * DNS Domains terminate canonically in a final ".", but we
	 * exclude this for most of our configuration. This function
	 * removes the trailing "." if it exists.
	 */
	private cleanDomain(domain: pulumi.Output<string>): pulumi.Output<string>;
	private cleanDomain(domain: string): string;
	private cleanDomain(domain: string | pulumi.Output<string>): string | pulumi.Output<string> {
		if (typeof domain !== 'string') {
			const that = this;
			return(domain.apply(function(realDomain) {
				return(that.cleanDomain(realDomain));
			})) as pulumi.Output<string>;
		}

		return(domain.replace(/\.+$/, ''));
	}

	/**
	 * Creates DNS Record with provided information
	 */
	public createDNSRecord(name: string, dnsEntry: DNSEntry, { parent = this, ...opts }: pulumi.ComponentResourceOptions = {}) {
		if (!this.dnsZoneCache) {
			throw(new Error('DNS Zone not initialized'));
		}

		const dnsNameInput = pulumi.output(dnsEntry.name);
		const dnsName = pulumi.interpolate`${this.cleanDomain(dnsNameInput)}.`;

		return new gcp.dns.RecordSet(`${this.name}-${name}-record-set`, {
			project: this.config.project,
			name: dnsName,
			managedZone: this.dnsZoneCache,
			type: dnsEntry.type,
			ttl: dnsEntry.ttl || 300,
			rrdatas: [dnsEntry.value]
		}, {
			...opts,
			parent,
			deleteBeforeReplace: true
		});
	}

	static formatDomain(input: pulumi.Input<string>, withPeriod: boolean) {
		return(pulumi.output(input).apply(function(domain) {
			if (!domain) {
				return('');
			}

			const hasPeriod = domain.endsWith('.');

			if (hasPeriod === false && withPeriod === true) {
				return(`${domain}.`);
			}

			if (hasPeriod === true && withPeriod === false) {
				return(domain.substring(0, domain.length - 1));
			}

			return(domain);
		}));
	}
}
