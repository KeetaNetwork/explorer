import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';
import { DNS } from './dns';
import type { ConfigDNS } from './dns';

const ipTypes = ['v4', 'v6'] as const;
type IPType = typeof ipTypes[number];

export type ConfigLoadBalancerService = {
	path?: string | string[];
	isDefault?: boolean;
	serviceId: pulumi.Input<string>;
};

export type ConfigLoadBalancer = {
	/**
	 * SSL Certificates to use for HTTPS
	 */
	sslCertificates: pulumi.Input<string>[];

	/**
	 * Configuration for managing DNS entries
	 */
	dns?: ConfigDNS;

	/**
	 * Types of IP addresses to create
	 */
	ips?: [IPType, ...IPType[]];
};

type Config = ConfigLoadBalancer & {
	services: {
		web: pulumi.Input<string>;
		api: pulumi.Input<string>;
		ws: pulumi.Input<string>;
	};
}

export class LoadBalancer extends pulumi.ComponentResource {

	private name: string;
	private config: Config;

	readonly ips: pulumi.Output<string[]>; // IPv4 and IPv6
	private ipAddresses!: {
		v4?: gcp.compute.GlobalAddress,
		v6?: gcp.compute.GlobalAddress
	};

	constructor(name: string, config: Config, opts?: pulumi.ComponentResourceOptions) {
		super('Explorer:GCP:LoadBalancer', name, config, opts);

		this.name = name;
		this.config = config;

		// Create IPs. Default to v6 if no IPs are specified
		if (!this.config.ips) {
			this.config.ips = ['v6'];
		}
		const createV4 = this.config.ips.includes('v4');
		const createV6 = this.config.ips.includes('v6');
		this.ips = this.setupIPAddresses(createV4, createV6);

		// Create HTTPS Proxy
		const httpsProxy = this.createHTTPSProxy();
		this.createForwardingRule(httpsProxy);

		// Create HTTP Proxy to redirect to HTTPS
		const httpProxy = this.createHTTPProxy();
		this.createForwardingRule(httpProxy);

		// Create DNS Records
		this.createDNSRecords();
	}

	/**
	 * Setup IP Addresses for Load Balancer
	 */
	private setupIPAddresses(createV4: boolean, createV6: boolean) {
		let v4 = undefined;
		let v6 = undefined;

		if (createV4) {
			v4 = new gcp.compute.GlobalAddress(`${this.name}-ipaddr-v4`, {
				addressType: 'EXTERNAL',
				ipVersion: 'IPV4'
			}, { parent: this });
		}

		if (createV6) {
			v6 = new gcp.compute.GlobalAddress(`${this.name}-ipaddr-v6`, {
				addressType: 'EXTERNAL',
				ipVersion: 'IPV6'
			}, { parent: this });
		}

		let ipsInterpolate = [];
		if (v4) { ipsInterpolate.push(pulumi.interpolate`${v4.address}/32`); }
		if (v6) { ipsInterpolate.push(pulumi.interpolate`${v6.address}/128`); }

		this.ipAddresses = { v4, v6 };
		return(pulumi.all(ipsInterpolate));
	}

	/**
	 * Create HTTPS Proxy with URLMap and SSL Certificates
	 */
	private createHTTPSProxy() {
		// const { defaultService, pathRules } = this.getDefaultAndPathRules();

		const httpsURLMap = new gcp.compute.URLMap(`${this.name}-urlmap-https`, {
			defaultService: this.config.services.web,
			hostRules: [{
				hosts: ['*'],
				pathMatcher: 'all-paths'
			}],
			pathMatchers: [{
				name: 'all-paths',
				defaultService: this.config.services.web,
				routeRules: [
					...["/assets/", "/icons/", "/fonts/", "/images/"].map((path, priority) => ({
						priority: priority + 1,
						matchRules: [{ prefixMatch: path }],
						service: this.config.services.web,
					})),
					{
						priority: 11,
						matchRules: [{ prefixMatch: "/api/v1/ws" }],
						service: this.config.services.ws
					},
					{
						priority: 12,
						matchRules: [{ prefixMatch: "/api/v1/ws/health" }],
						service: this.config.services.ws
					},
					{
						priority: 13,
						matchRules: [{ prefixMatch: "/api/" }],
						service: this.config.services.api
					},
					{
						priority: 14,
						matchRules: [{ prefixMatch: "/" }],
						service: this.config.services.web,
					},
				]
			}]
		}, { parent: this });

		const httpsProxy = new gcp.compute.TargetHttpsProxy(`${this.name}-https-proxy`, {
			urlMap: httpsURLMap.selfLink,
			sslCertificates: this.config.sslCertificates
		}, { parent: httpsURLMap });

		return(httpsProxy);
	}

	/**
	 * Create HTTP Proxy to redirect to HTTPS
	 */
	private createHTTPProxy() {
		const httpURLMap = new gcp.compute.URLMap(`${this.name}-urlmap-http`, {
			defaultUrlRedirect: { stripQuery: false, httpsRedirect: true }
		}, { parent: this });

		const httpProxy = new gcp.compute.TargetHttpProxy(`${this.name}-http-proxy`, {
			urlMap: httpURLMap.selfLink
		}, { parent: httpURLMap });

		return(httpProxy);
	}

	/**
	 * Create Global Forwarding rule based on supplied proxy, ip, port, and ip version
	 */
	private createForwardingRule(urlMap: gcp.compute.TargetHttpsProxy | gcp.compute.TargetHttpProxy) {
		let forwardingRuleName = 'http';
		let portRange = '80';

		if (gcp.compute.TargetHttpsProxy.isInstance(urlMap)) {
			forwardingRuleName = 'https';
			portRange = '443';
		}

		if (this.ipAddresses.v4) {
			new gcp.compute.GlobalForwardingRule(`${this.name}-forwarding-${forwardingRuleName}-v4`, {
				target: urlMap.selfLink,
				ipAddress: this.ipAddresses.v4.address,
				portRange: portRange,
				loadBalancingScheme: 'EXTERNAL'
			}, { parent: urlMap });
		}

		if (this.ipAddresses.v6) {
			new gcp.compute.GlobalForwardingRule(`${this.name}-forwarding-${forwardingRuleName}-v6`, {
				target: urlMap.selfLink,
				ipAddress: this.ipAddresses.v6.address,
				portRange: portRange,
				loadBalancingScheme: 'EXTERNAL'
			}, { parent: urlMap });
		}
	}

	/**
	 * Create the DNS records
	 */
	private createDNSRecords() {
		if (this.config.dns) {
			// Initialize DNS
			const dns = DNS.initialize(`${this.name}-dns`, this.config.dns, { parent: this });

			// Create DNS Records for IPv4
			if (this.ipAddresses.v4) {
				dns.createDNSRecord('ipv4', {
					name: DNS.formatDomain(this.config.dns.baseDomain, true),
					type: 'A',
					value: this.ipAddresses.v4.address
				}, { parent: this.ipAddresses.v4 });
			}

			// Create DNS Records for IPv6
			if (this.ipAddresses.v6) {
				dns.createDNSRecord('ipv6', {
					name: DNS.formatDomain(this.config.dns.baseDomain, true),
					type: 'AAAA',
					value: this.ipAddresses.v6.address
				}, { parent: this.ipAddresses.v6 });
			}
		}
	}
}
