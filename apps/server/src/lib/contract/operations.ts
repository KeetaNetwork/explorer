/**
 * Contract operations and call outcomes, as a KeetaNet client with contract
 * support gives them.
 *
 * The client published on npm does not know contracts, so they are described
 * here structurally and looked for at run time: with that client, no block
 * has these operations and no vote carries outcomes, and contract support is
 * simply absent.
 */
import { KeetaNetLib } from '@/utils/keetanet';

type GenericAccount = ReturnType<typeof KeetaNetLib.lib.Account.fromPublicKeyString>;
type Block = InstanceType<typeof KeetaNetLib.lib.Block>;
type VoteStaple = InstanceType<typeof KeetaNetLib.lib.Vote.Staple>;

export const ContractOperationType = {
	CONTRACT_DEPLOY: 9,
	CONTRACT_CALL: 10,
	CONTRACT_ORDER: 11
} as const;

export type ContractOperationName = keyof typeof ContractOperationType;

export interface ContractDeployOperation {
	type: typeof ContractOperationType.CONTRACT_DEPLOY;
	contract: GenericAccount;
	code: Buffer;
	sequencer: GenericAccount;
	admin?: GenericAccount | undefined;
}

export interface ContractCallOperation {
	type: typeof ContractOperationType.CONTRACT_CALL;
	contract: GenericAccount;
	accounts: { owner: GenericAccount, id: Buffer, writable: boolean }[];
	data: Buffer;
	gasLimit: bigint;
}

export interface ContractOrderOperation {
	type: typeof ContractOperationType.CONTRACT_ORDER;
	calls: { block: { toString(): string }, operationIndex: number }[];
}

export type ContractOperation = ContractDeployOperation | ContractCallOperation | ContractOrderOperation;

export function contractOperationName(type: number): ContractOperationName | null {
	for (const [name, value] of Object.entries(ContractOperationType)) {
		if (value === type) {
			return(name as ContractOperationName);
		}
	}
	return(null);
}

export function isContractOperation(operation: { type: number }): operation is ContractOperation {
	return(contractOperationName(operation.type) !== null);
}

export function isContractCall(operation: { type: number }): operation is ContractCallOperation {
	return(operation.type === ContractOperationType.CONTRACT_CALL);
}

export function isContractDeploy(operation: { type: number }): operation is ContractDeployOperation {
	return(operation.type === ContractOperationType.CONTRACT_DEPLOY);
}

export function isContractOrder(operation: { type: number }): operation is ContractOrderOperation {
	return(operation.type === ContractOperationType.CONTRACT_ORDER);
}

/** A block's operations, as plain `{ type }` objects (contract operations included) */
export function blockOperations(block: Block): { type: number }[] {
	return(block.operations as unknown as { type: number }[]);
}

/**
 * Call outcomes, as votes carry them
 */
export interface ContractStateAccess {
	owner: GenericAccount;
	id: Buffer;
	version: bigint;
	data?: Buffer | null;
}

export type ContractEffect = {
	kind: 'send';
	from: GenericAccount;
	to: GenericAccount;
	token: GenericAccount;
	amount: bigint;
	external?: string | undefined;
} | {
	kind: 'setInfo';
	account: GenericAccount;
	name: string;
	description: string;
	metadata: string;
};

export interface ContractCallOutcome {
	block: { toString(): string };
	operationIndex: number;
	gasUsed: bigint;
	returnData: Buffer;
	reads: ContractStateAccess[];
	writes: ContractStateAccess[];
	effects: ContractEffect[];
	failure?: { kind: string, message: string } | undefined;
}

interface ContractOutcomesClass {
	fromDER(der: ArrayBuffer): { calls: ContractCallOutcome[] };
}

function outcomesClass(): ContractOutcomesClass | null {
	const lib = KeetaNetLib.lib as unknown as { Contract?: { Outcomes?: ContractOutcomesClass } };
	return(lib.Contract?.Outcomes ?? null);
}

/**
 * The outcome of every contract call in a staple, as its votes carry it
 * (each vote carries the same one); `null` if they carry none
 */
export function stapleContractOutcomes(staple: VoteStaple): ContractCallOutcome[] | null {
	const Outcomes = outcomesClass();
	if (!Outcomes) {
		return(null);
	}

	for (const vote of staple.votes) {
		const der = (vote as unknown as { contractOutcomes?: ArrayBuffer }).contractOutcomes;
		if (der === undefined) {
			continue;
		}
		return(Outcomes.fromDER(der).calls);
	}

	return(null);
}

/**
 * A KeetaNet client's contract methods, if it has them
 */
export interface ContractClient {
	getContract(contract: GenericAccount | string): Promise<{
		codeHash: string;
		admin: GenericAccount | null;
		creator: GenericAccount;
		sequencer: GenericAccount;
	} | null>;
	getContractCode(contract: GenericAccount | string): Promise<{ codeHash: string, code: Buffer } | null>;
	listContractState(contract: GenericAccount | string, options?: { startAfter?: Buffer | string, limit?: number }): Promise<{ id: Buffer, version: bigint, data: Buffer }[]>;
}

export function contractClient(client: object): ContractClient | null {
	const candidate = client as Partial<ContractClient>;
	if (typeof candidate.getContract !== 'function' || typeof candidate.getContractCode !== 'function' || typeof candidate.listContractState !== 'function') {
		return(null);
	}
	return(client as ContractClient);
}
