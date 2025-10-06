export enum LogLevels {
	DEBUG = 'DEBUG',
	INFO = 'INFO',
	WARN = 'WARN',
	ERROR = 'ERROR',
	NONE = 'NONE'
}

export type LogLevel = keyof typeof LogLevels;

export enum NumericLogLevels {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
	NONE = 4
}

export enum LogLabel {
	TRANSACTION = 'TRANSACTION',
	USER = 'USER',
	WEBHOOK = 'WEBHOOK'
}

export type LogEntry = {
	level: LogLevel;
	from: string;
	args: unknown[];
};

export function assertLogLevels(level: string, message?: string): asserts level is LogLevels {
	if (!(level in LogLevels)) {
		throw(new Error(message ?? `Invalid log level: ${level}`));
	}
}
