import * as console from 'console';
import { LogLevels } from './types';
import { type LogEntry, type LogLevel, NumericLogLevels } from './types';

export class Logger {
	#logs: LogEntry[] = [];
	#autoSyncInterval?: NodeJS.Timeout;
	#level: LogLevels;

	constructor(level: LogLevels) {
		this.#level = level;
	}

	#canLogForLevel(level: LogLevel): boolean {
		return(NumericLogLevels[level] >= NumericLogLevels[this.#level]);
	}

	#addLog(level: LogLevel, from: string, ...args: unknown[]): void {
		this.#logs.push({ level, from, args });

		/**
		 * Automatically flush logs for now
		 */
		void this.sync();
	}

	#extractArguments(args: unknown[]): { from: string } {
		const from = args.shift();
		if (typeof from !== 'string') {
			throw(new Error('First argument must be a string'));
		}

		return({ from });
	}

	log(from: string, ...args: unknown[]): void;
	log(...args: unknown[]) {
		const { from } = this.#extractArguments(args);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this.#addLog('INFO', from, ...args);
	}

	info(from: string, ...args: unknown[]): void;
	info(...args: unknown[]) {
		const { from } = this.#extractArguments(args);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this.#addLog('INFO', from, ...args);
	}

	debug(from: string, ...args: unknown[]): void;
	debug(...args: unknown[]) {
		const { from } = this.#extractArguments(args);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this.#addLog('DEBUG', from, ...args);
	}

	warn(from: string, ...args: unknown[]): void;
	warn(...args: unknown[]) {
		const { from } = this.#extractArguments(args);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this.#addLog('WARN', from, ...args);
	}

	error(from: string, ...args: unknown[]): void;
	error(...args: unknown[]) {
		const { from } = this.#extractArguments(args);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		this.#addLog('ERROR', from, ...args);
	}

	async emitLogs(logs: LogEntry[]) {
		for (const log of logs) {
			let method: 'log' | 'info' | 'warn' | 'error';

			switch (log.level) {
				case 'ERROR':
					method = 'error';
					break;
				case 'WARN':
					method = 'warn';
					break;
				default:
					method = 'log';
					break;
			}

			if (this.#canLogForLevel(log.level)) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
				console[method](`[${log.level}] ${log.from}:`, ...log.args);
			}
		}
	}

	startAutoSync(rate = 100) {
		if (this.#autoSyncInterval) {
			return;
		}

		this.#autoSyncInterval = setInterval(() => {
			void this.sync();
		}, rate);
	}

	stopAutoSync() {
		if (!this.#autoSyncInterval) {
			return;
		}

		clearInterval(this.#autoSyncInterval);
		this.#autoSyncInterval = undefined;
	}

	async sync(): Promise<void> {
		while (this.#logs.length > 0) {
			const logs = this.#logs.splice(0, 10);

			await this.emitLogs(logs);
		}
	}
}