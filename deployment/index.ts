import * as pulumi from '@pulumi/pulumi';
import { ExplorerDeployment } from '@keetanetwork/explorer-cloud';
import type { ConfigExplorerDeployment } from '@keetanetwork/explorer-cloud';

/**
 * Get the name of the Pulumi stack being deployed so we can find the right config
 * values for this stack.
 */
const deploymentName = pulumi.getStack();

/**
 * Get the GitHub SHA from the environment variables.
 */
let githubSha: string | undefined;
if (process.env.GITHUB_SHA) {
	githubSha = `git_${process.env.GITHUB_SHA}`;
}

/**
 * Create the deployment configuration.
 */
const config: ConfigExplorerDeployment = {
	deploymentName,
	network: {
		project: 'mimetic-algebra-344104',
		regions: [{ region: 'us-central1' }],
	},
	image: {
		registryUrl: `us-central1-docker.pkg.dev/mimetic-algebra-344104/keeta/${deploymentName}-explorer-server-image`,
		remote: {
			bindPermissions: true
		},
		build: {
			githubSha
		},
	},
	loadBalancer: {
		sslCertificates: ['dev-explorer-cf-20240519']
	},
	services: {
		serverUrl: 'https://dev.explorer.keeta.com',
		defaultNetwork: 'test',
		availableNetworks: ['test', 'dev', 'main', 'staging'],
		// logLevel: 'DEBUG',
		logLevel: 'WARN',
	}
};

// Create the deployment.
new ExplorerDeployment(`explorer-${deploymentName}`, config, {});

