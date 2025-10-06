import { KeetaNetLib } from "@/utils/keetanet";
import Numeric from '@/utils/numeric';

type Block = InstanceType<typeof KeetaNetLib.lib.Block>;
type BlockOperations = Block['operations'][number];
type BlockOperationTypes = keyof typeof KeetaNetLib.lib.Block.OperationType;
type Operation<T extends BlockOperationTypes> = InstanceType<typeof KeetaNetLib.lib.Block.Operation[T]>;
type OperationType = typeof KeetaNetLib.lib.Block.OperationType[keyof typeof KeetaNetLib.lib.Block.OperationType];

export type TokenType = 'PUBLIC_KEY' | 'CURRENCY_CODE';

type TransactionBase = {
	blockhash: string;
	operationType: BlockOperationTypes;
	settledAt: Date;
};

type TransactionSendOrReceive = TransactionBase & {
	operationType: Extract<BlockOperationTypes, 'SEND' | 'RECEIVE'>;
	address: string;
	amount: Numeric;
	tokenPublicKey: string;
	$account?: string;
};

type TransactionModifyBalanceOrSupply = TransactionBase & {
	operationType: Extract<BlockOperationTypes, 'TOKEN_ADMIN_MODIFY_BALANCE' | 'TOKEN_ADMIN_SUPPLY'>;
	method: keyof typeof KeetaNetLib.lib.Block.AdjustMethod;
	amount: Numeric;
	tokenPublicKey: string;
	$account?: string;
};

type TransactionSetRep = TransactionBase & {
	operationType: Extract<BlockOperationTypes, 'SET_REP'>;
	address: string;
	$account?: string;
};

type TransactionSetInfo = TransactionBase & {
	operationType: Extract<BlockOperationTypes, 'SET_INFO'>;
	tokenPublicKey: string;
};

type TransactionManageCertificate = TransactionBase & {
	operationType: Extract<BlockOperationTypes, 'MANAGE_CERTIFICATE'>;
	method: keyof typeof KeetaNetLib.lib.Block.AdjustMethod;
	hash: string;
	account: string;
};

type TransactionOthers = TransactionBase & {
	operationType: Exclude<BlockOperationTypes, 'SEND' | 'RECEIVE' | 'TOKEN_ADMIN_MODIFY_BALANCE' | 'TOKEN_ADMIN_SUPPLY' | 'SET_REP' | 'SET_INFO' | 'MANAGE_CERTIFICATE'>
};

export type Transaction = TransactionSendOrReceive | TransactionModifyBalanceOrSupply | TransactionSetRep | TransactionSetInfo | TransactionManageCertificate | TransactionOthers

function operationSendAsTransaction(
	operation: Operation<'SEND'>,
	block: Block,
	accountPublicKey: string,
	addAccount: boolean = false
): TransactionSendOrReceive {
	const [operationType, amount, address, $account]: [Transaction['operationType'], bigint, string, string] = function() {
		const toPublicKey = operation.to.publicKeyString.toString();
		if (toPublicKey === accountPublicKey) {
			return(['RECEIVE', operation.amount, block.account.publicKeyString.toString(), toPublicKey]);
		} else {
			return(['SEND', operation.amount * -1n, toPublicKey, block.account.publicKeyString.toString()]);
		}
	}();

	return({
		blockhash: block.hash.toString(),
		operationType,
		address,
		amount: new Numeric(amount),
		settledAt: block.date,
		tokenPublicKey: operation.token.publicKeyString.toString(),
		...(addAccount ? { $account } : {})
	});
}

function operationReceiveAsTransaction(
	operation: Operation<'RECEIVE'>,
	block: Block,
	_ignore_accountPublicKey: string,
	addAccount: boolean = false
): TransactionSendOrReceive {
	return({
		blockhash: block.hash.toString(),
		operationType: 'RECEIVE',
		address: operation.from.publicKeyString.toString(),
		amount: new Numeric(operation.amount),
		settledAt: block.date,
		tokenPublicKey: operation.token.publicKeyString.toString(),
		...(addAccount ? { $account: block.account.publicKeyString.toString() } : {})
	});
}

const mapMethodName = {
	[KeetaNetLib.lib.Block.AdjustMethod.ADD]: 'ADD',
	[KeetaNetLib.lib.Block.AdjustMethod.SUBTRACT]: 'SUBTRACT',
	[KeetaNetLib.lib.Block.AdjustMethod.SET]: 'SET'
} as const;

function operationTokenAdminModifyBalanceAsTransaction(
	operation: Operation<'TOKEN_ADMIN_MODIFY_BALANCE'>,
	block: Block,
	_ignore_accountPublicKey: string,
	addAccount: boolean = false
): TransactionModifyBalanceOrSupply {
	const amount = operation.method === KeetaNetLib.lib.Block.AdjustMethod.SUBTRACT ? operation.amount * -1n : operation.amount;
	return({
		blockhash: block.hash.toString(),
		operationType: 'TOKEN_ADMIN_MODIFY_BALANCE',
		method: mapMethodName[operation.method],
		amount: new Numeric(amount),
		settledAt: block.date,
		tokenPublicKey: operation.token.publicKeyString.toString(),
		...(addAccount ? { $account: block.account.publicKeyString.toString() } : {})
	});
}

function operationTokenAdminSupplyAsTransaction(
	operation: Operation<'TOKEN_ADMIN_SUPPLY'>,
	block: Block,
	_ignore_accountPublicKey: string,
	_ignore_addAccount: boolean = false
): TransactionModifyBalanceOrSupply {
	const amount = operation.method === KeetaNetLib.lib.Block.AdjustMethod.SUBTRACT ? operation.amount * -1n : operation.amount;
	return({
		blockhash: block.hash.toString(),
		operationType: 'TOKEN_ADMIN_SUPPLY',
		method: mapMethodName[operation.method],
		amount: new Numeric(amount),
		settledAt: block.date,
		tokenPublicKey: block.account.publicKeyString.toString()
	});
}

function operationSetRepAsTransaction(
	operation: Operation<'SET_REP'>,
	block: Block,
	_ignore_accountPublicKey: string,
	addAccount: boolean = false
): TransactionSetRep {
	return({
		blockhash: block.hash.toString(),
		operationType: 'SET_REP',
		address: operation.to.publicKeyString.toString(),
		settledAt: block.date,
		...(addAccount ? { $account: block.account.publicKeyString.toString() } : {})
	});
}

function operationSetInfoAsTransaction(
	operation: Operation<'SET_INFO'>,
	block: Block,
	_ignore_accountPublicKey: string,
	_ignore_addAccount: boolean = false
): TransactionSetInfo {
	return({
		blockhash: block.hash.toString(),
		operationType: 'SET_INFO',
		tokenPublicKey: block.account.publicKeyString.toString(),
		settledAt: block.date
	});
}

function operationModifyPermissionsAsTransaction(
	operation: Operation<'MODIFY_PERMISSIONS'>,
	block: Block,
	_ignore_accountPublicKey: string,
	_ignore_addAccount: boolean = false
): Transaction {
	return({
		blockhash: block.hash.toString(),
		operationType: 'MODIFY_PERMISSIONS',
		settledAt: block.date
	});
}

function operationCreateIdentifierAsTransaction(
	operation: Operation<'CREATE_IDENTIFIER'>,
	block: Block,
	_ignore_accountPublicKey: string,
	_ignore_addAccount: boolean = false
): Transaction {
	return({
		blockhash: block.hash.toString(),
		operationType: 'CREATE_IDENTIFIER',
		settledAt: block.date
	});
}

function operationManageCertificateAsTransaction(
	operation: Operation<'MANAGE_CERTIFICATE'>,
	block: Block,
	_ignore_accountPublicKey: string,
	_ignore_addAccount: boolean = false
): Transaction {
	let hash: string | undefined;
	if (KeetaNetLib.lib.Utils.Certificate.CertificateHash.isInstance(operation.certificateOrHash)) {
		hash = operation.certificateOrHash.toString();
	} else {
		hash = operation.certificateOrHash.hash().toString();
	}

	return({
		blockhash: block.hash.toString(),
		operationType: 'MANAGE_CERTIFICATE',
		settledAt: block.date,
		method: mapMethodName[operation.method],
		hash: hash,
		account: block.account.publicKeyString.toString()
	});
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapOperationTransformer: { [key in OperationType]: (operation: any, block: Block, accountPublicKey: string, addAccount?: boolean) => Transaction } = {
	[KeetaNetLib.lib.Block.OperationType.SEND]: operationSendAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.RECEIVE]: operationReceiveAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.TOKEN_ADMIN_MODIFY_BALANCE]: operationTokenAdminModifyBalanceAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.TOKEN_ADMIN_SUPPLY]: operationTokenAdminSupplyAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.SET_REP]: operationSetRepAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.SET_INFO]: operationSetInfoAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.MODIFY_PERMISSIONS]: operationModifyPermissionsAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.CREATE_IDENTIFIER]: operationCreateIdentifierAsTransaction,
	[KeetaNetLib.lib.Block.OperationType.MANAGE_CERTIFICATE]: operationManageCertificateAsTransaction
};

export function blockOperationAsTransaction(operation: BlockOperations, block: Block, accountPublicKey?: string, addAccount: boolean = false): Transaction[] {
	// @ts-ignore
	return(mapOperationTransformer[operation.type](operation, block, accountPublicKey, addAccount));
}

export function blockAsTransactions(block: Block, accountPublicKey?: string, addAccount: boolean = false): Transaction[] {
	return(block.operations.flatMap(function(operation) {
		return(blockOperationAsTransaction(operation, block, accountPublicKey, addAccount));
	}));
}

export function voteStaplesAsTransactions(voteStaples: InstanceType<typeof KeetaNetLib.lib.Vote.Staple>[], accountPublicKey?: string): Transaction[] {
	if (accountPublicKey) {
		const account = KeetaNetLib.lib.Account.fromPublicKeyString(accountPublicKey);
		const filteredStaples = KeetaNetLib.UserClient.filterStapleOperations(voteStaples, account);

		return Object.values(filteredStaples).flatMap(function(staples) {
			return staples.flatMap(function({ block, filteredOperations }) {
				return filteredOperations.flatMap(function(operation) {
					return(blockOperationAsTransaction(operation, block, accountPublicKey, true));
				});
			});
			//
		});
	}

	return(voteStaples.flatMap(function(voteStaple) {
		return voteStaple.blocks.flatMap(function(block) {
			return(blockAsTransactions(block, undefined, true));
		});
	}));
}

