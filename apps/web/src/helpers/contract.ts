import * as Anchor from "@keetanetwork/anchor";

const KeetaNetLib = Anchor.KeetaNet;

/**
 * Contract operations, which only a KeetaNet client with contract support
 * produces (on a local network): described here so blocks holding them can
 * be shown with any client
 */
export const ContractOperationType = {
	CONTRACT_DEPLOY: 9,
	CONTRACT_CALL: 10,
	CONTRACT_ORDER: 11
} as const;

export type ContractOperationName = keyof typeof ContractOperationType;

export type ContractDeployJSON = {
	type: typeof ContractOperationType.CONTRACT_DEPLOY;
	name: 'CONTRACT_DEPLOY';
	contract: string;
	sequencer: string;
	admin: string | null;
	/** Bytes of code (the code itself is left out) */
	codeSize: number;
};

export type ContractCallJSON = {
	type: typeof ContractOperationType.CONTRACT_CALL;
	name: 'CONTRACT_CALL';
	contract: string;
	accounts: { owner: string, id: string, writable: boolean }[];
	/** Instruction data, hex */
	data: string;
	gasLimit: string;
};

export type ContractOrderJSON = {
	type: typeof ContractOperationType.CONTRACT_ORDER;
	name: 'CONTRACT_ORDER';
	/** The calls ordered, each with the contract it calls when its staple was at hand */
	calls: { block: string, operationIndex: number, contract?: string }[];
	/**
	 * The contracts this order is for: those its calls call or, with no calls
	 * of its own, those called elsewhere in its staple. An order with no calls
	 * pins its contract's chain for them, because those calls read or change
	 * its state when one contract calls another. Empty without the staple.
	 */
	calledContracts: string[];
};

export type ContractOperationJSON = ContractDeployJSON | ContractCallJSON | ContractOrderJSON;

type Serializable = { toString(): string };

function accountString(account: unknown): string {
	if (typeof account === 'string') {
		return(account);
	}
	return((account as InstanceType<typeof KeetaNetLib.lib.Account>).publicKeyString.get());
}

function bytesHex(value: unknown): string {
	if (value instanceof Uint8Array) {
		return(Array.from(value, byte => byte.toString(16).padStart(2, '0')).join(''));
	}
	return(String(value).toLowerCase());
}

const callKey = (block: string, operationIndex: number) => `${block.toUpperCase()}#${operationIndex}`;

/**
 * The contract each call in a staple calls, by its block and operation index
 */
export function stapleCalls(blocks: { hash: { toString(): string }, operations: readonly unknown[] }[]): Map<string, string> {
	const calls = new Map<string, string>();
	for (const block of blocks) {
		block.operations.forEach((operation, index) => {
			const op = operation as { type?: unknown, contract?: unknown };
			if (op.type === ContractOperationType.CONTRACT_CALL) {
				calls.set(callKey(block.hash.toString(), index), accountString(op.contract));
			}
		});
	}
	return(calls);
}

/**
 * A contract operation as JSON, `null` for other operations. `calls`, the
 * staple's calls (see {@link stapleCalls}), names what an order is for.
 */
export function serializeContractOperation(operation: unknown, calls?: Map<string, string>): ContractOperationJSON | null {
	if (!operation || typeof operation !== 'object' || !('type' in operation)) {
		return(null);
	}

	const op = operation as { type: number, [key: string]: unknown };
	switch (op.type) {
		case ContractOperationType.CONTRACT_DEPLOY: {
			const code = op.code as Uint8Array | string;
			return({
				type: op.type,
				name: 'CONTRACT_DEPLOY',
				contract: accountString(op.contract),
				sequencer: accountString(op.sequencer),
				admin: op.admin ? accountString(op.admin) : null,
				codeSize: typeof code === 'string' ? code.length / 2 : code.length
			});
		}
		case ContractOperationType.CONTRACT_CALL: {
			const accounts = op.accounts as { owner: unknown, id: unknown, writable: boolean }[];
			return({
				type: op.type,
				name: 'CONTRACT_CALL',
				contract: accountString(op.contract),
				accounts: accounts.map(account => ({ owner: accountString(account.owner), id: bytesHex(account.id), writable: account.writable })),
				data: bytesHex(op.data),
				gasLimit: BigInt(op.gasLimit as bigint | string).toString()
			});
		}
		case ContractOperationType.CONTRACT_ORDER: {
			const ordered = (op.calls as { block: Serializable, operationIndex: number }[]).map(call => {
				const block = call.block.toString();
				const contract = calls?.get(callKey(block, call.operationIndex));
				return({ block, operationIndex: call.operationIndex, ...(contract !== undefined ? { contract } : {}) });
			});
			const called = ordered.length > 0 ? ordered.flatMap(call => call.contract ?? []) : [...(calls?.values() ?? [])];
			return({
				type: op.type,
				name: 'CONTRACT_ORDER',
				calls: ordered,
				calledContracts: [...new Set(called)]
			});
		}
		default:
			return(null);
	}
}

/**
 * A serialized operation's contract operation, if it is one
 */
export function asContractOperation(operation: unknown): ContractOperationJSON | null {
	if (!operation || typeof operation !== 'object' || !('name' in operation) || !('type' in operation)) {
		return(null);
	}
	const { type } = operation as { type: unknown };
	if (type === ContractOperationType.CONTRACT_DEPLOY || type === ContractOperationType.CONTRACT_CALL || type === ContractOperationType.CONTRACT_ORDER) {
		return(operation as ContractOperationJSON);
	}
	return(null);
}

/** Group digits of a decimal integer string */
export function formatInteger(value: string | number | bigint): string {
	const text = String(value);
	const negative = text.startsWith('-');
	const digits = negative ? text.slice(1) : text;
	if (!/^\d+$/.test(digits)) {
		return(text);
	}
	return(`${negative ? '-' : ''}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`);
}

/** A size, short: "652 B", "7.2 KiB", "1.3 MiB" */
export function formatBytes(size: number): string {
	if (size < 1024) {
		return(`${size} B`);
	}
	if (size < 1024 * 1024) {
		return(`${(size / 1024).toFixed(1)} KiB`);
	}
	return(`${(size / (1024 * 1024)).toFixed(1)} MiB`);
}
