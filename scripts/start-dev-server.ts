#!/usr/bin/env -S npx tsx
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function runSubprojectServer(path: string, command: string, args: string[] = [], envVars: Record<string, string | undefined> = {}) {
	const child = spawn(command, args, {
		cwd: path,
		stdio: 'inherit',
		shell: true,
		env: {
			...process.env,
			...envVars,
		},
	});

	child.on('close', (code) => {
		console.log(`Process in ${path} exited with code ${code}`);
	});

	child.on('error', (err) => {
		console.error(`Error starting process in ${path}:`, err);
	});

	return child;
}

const apiPort = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 3010;
const clientPort = process.env.CLIENT_PORT ? parseInt(process.env.CLIENT_PORT, 10) : 3011;

/**
 * A local network (development only): KEETA_LOCAL_NETWORK is the path of
 * its endpoints.json, as the node's utils/local-network.mjs writes it. Its
 * representatives then serve its network alias (the test network's) for
 * both the API and the web app, and contracts are shown.
 * KEETA_CONTRACT_VERIFIER_URL optionally points the API at a contract
 * verifier.
 */
type LocalNetworkEndpoints = {
	network: string | number;
	networkAlias: string;
	representatives: { key: string, api: string, p2p: string }[];
};

function localNetworkEnvironment(path: string): { server: Record<string, string>, web: Record<string, string> } {
	const absolutePath = resolve(path);
	const endpoints = JSON.parse(readFileSync(absolutePath, 'utf-8')) as LocalNetworkEndpoints;
	const { network, networkAlias, representatives } = endpoints;
	console.log(`Using the local network in ${absolutePath} (alias "${networkAlias}", ${representatives.length} representatives)`);

	return({
		server: {
			APP_LOCAL_NETWORK: absolutePath,
			APP_DEFAULT_NETWORK: networkAlias,
		},
		web: {
			VITE_APP_LOCAL_NETWORK: JSON.stringify({ network, networkAlias, representatives }),
			VITE_APP_DEFAULT_NETWORK: networkAlias,
			VITE_APP_AVAILABLE_NETWORKS: networkAlias,
		}
	});
}

const localNetworkPath = process.env.KEETA_LOCAL_NETWORK;
const local = localNetworkPath ? localNetworkEnvironment(localNetworkPath) : { server: {}, web: {} };
const verifierURL = process.env.KEETA_CONTRACT_VERIFIER_URL;

const serverEnvironment = {
	APP_LISTEN_PORT: String(apiPort),
	...local.server,
	...(verifierURL ? { APP_CONTRACT_VERIFIER_URL: verifierURL } : {}),
};
const webEnvironment = {
	PORT: String(clientPort),
	VITE_API_BASE_URL: `http://localhost:${apiPort}/`,
	...local.web,
};

/*
 * With a local network, the web app starts without reinstalling its
 * dependencies (which its `make do-dev-server` does each time), so the
 * KeetaNet client with contract support installed there stays
 */
const webCommand: [string, string[]] = localNetworkPath
	? ['make', ['-C', '../server', 'dist', '&&', 'npm', 'run', 'vite', '--', '--host', '0.0.0.0', '-l', 'info']]
	: ['npm', ['run', 'dev']];

const processes = [
	runSubprojectServer('apps/server', 'npm', ['run', 'dev'], serverEnvironment),
	runSubprojectServer('apps/web', ...webCommand, webEnvironment),
];

process.on('SIGINT', () => {
	processes.forEach((p) => p.kill());
	process.exit(0);
});
