#!/usr/bin/env -S npx tsx
import { spawn } from 'child_process';

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

const processes = [
	runSubprojectServer('apps/server', 'npm', ['run', 'dev'], { APP_LISTEN_PORT: String(apiPort) }),
	runSubprojectServer('apps/web', 'npm', ['run', 'dev'], { PORT: String(clientPort), VITE_API_BASE_URL: `http://localhost:${apiPort}/` }),
];

process.on('SIGINT', () => {
	processes.forEach((p) => p.kill());
	process.exit(0);
});
