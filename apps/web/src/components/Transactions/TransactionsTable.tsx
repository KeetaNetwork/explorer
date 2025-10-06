import Table, { TableRowItem, type TableColumn } from "@/components/Table";
import { TextBlockLink } from "@/components/TextBlockLink";
import { Icon, Typography } from "@keetanetwork/web-ui";
import { Fragment } from "preact/jsx-runtime";

import dayjs from "dayjs";
import relativeTime from 'dayjs/plugin/relativeTime';
import { TextAccountLink } from "@/components/TextAccountLink";

import * as Anchor from "@keetanetwork/anchor";
import TokenAmount from "@/components/TokenAmount";
import { getAdjustMethodName } from "@/helpers/keetanet";
import { TextTokenLink } from "@/components/TextTokenLink";
import { TextCertificateLink } from "@/components/TextCertificateLink";
import type { ComponentChildren } from "preact";
import type { Operation } from "@/hooks/useTransactions";
import { Numeric } from "@keetanetwork/web-ui/helpers/Numeric";

export interface TransactionsTableProps {
	operations: Operation[]
	className?: string
}

dayjs.extend(relativeTime);

const columns: TableColumn[] = [
	{ title: 'Block' },
	{ title: 'Age' },
	{ title: 'Type' },
	{ title: 'From' },
	{ title: 'To' },
	{ title: 'Amount' }
];

function renderRowSEND(row: Operation & { type: "SEND" }) {
	return (
		<>
			<TextAccountLink publicKey={row.block.account} />
			<TextAccountLink publicKey={row.operation.to} />
			<TokenAmount
				amount={new Numeric(BigInt(row.operation.amount))}
				tokenPublicKey={row.operation.token}
				className='whitespace-nowrap'
			/>
		</>
	)
}

function renderRowRECEIVE(row: Operation & { type: "RECEIVE" }) {
	return (
		<>
			<TextAccountLink publicKey={row.operation.from} />
			<TextAccountLink publicKey={row.toAccount} />
			<TokenAmount
				amount={new Numeric(BigInt(row.operation.amount))}
				tokenPublicKey={row.operation.token}
				className='whitespace-nowrap'
			/>
		</>
	)
}

function renderRowSWAP(row: Operation & { type: "SWAP" }) {
	const blockAccount = Anchor.KeetaNet.lib.Account.fromPublicKeyString(row.block.account);
	const accountFrom = blockAccount.comparePublicKey(row.operationReceive.from) ? row.operationReceive.from : row.block.account;
	const accountTo = blockAccount.comparePublicKey(row.operationReceive.from) ? row.operationSend.to : row.operationReceive.from;
	return (
		<>
			<TextAccountLink publicKey={accountFrom} />
			<TextAccountLink publicKey={accountTo} />
			<TableRowItem className='col-span-2' position="last">
				<TokenAmount
					amount={new Numeric(BigInt(row.operationSend.amount))}
					tokenPublicKey={row.operationSend.token}
					className='whitespace-nowrap'
				/>

				<Icon type="rotate" className="size-3" />

				<TokenAmount
					amount={new Numeric(BigInt(row.operationReceive.amount))}
					tokenPublicKey={row.operationReceive.token}
					className='whitespace-nowrap'
				/>
			</TableRowItem>
		</>
	)
}

function renderRowSWAP_FORWARD(row: Operation & { type: "SWAP_FORWARD" }) {
	const blockAccount = Anchor.KeetaNet.lib.Account.fromPublicKeyString(row.block.account);
	const forwardAccount = row.operationForward.forward ? Anchor.KeetaNet.lib.Account.fromPublicKeyString(row.operationForward.forward) : null;
	const accountFrom = blockAccount.comparePublicKey(row.operationForward.from) ? row.operationForward.from : row.block.account;
	const accountTo = blockAccount.comparePublicKey(row.operationForward.from) ? row.operationSend.to : row.operationForward.from;
	return (
		<>
			{blockAccount.comparePublicKey(row.operationForward.from) && forwardAccount ? (
				<>
					<TableRowItem className='col-span-6 justify-between' position="last">
						<div className="flex items-center gap-1.5">
							<Typography size="sm" className="text-slate-500">Forwarded To</Typography>
							<TextAccountLink publicKey={forwardAccount.publicKeyString.toString()} truncateChars={6} />
						</div>

						<div className="flex items-center gap-1.5">
							<TokenAmount
								amount={new Numeric(BigInt(row.operationSend.amount))}
								tokenPublicKey={row.operationSend.token}
								className='whitespace-nowrap'
							/>

							<Icon type="rotate" className="size-3" />

							<TokenAmount
								amount={new Numeric(BigInt(row.operationForward.amount))}
								tokenPublicKey={row.operationForward.token}
								className='whitespace-nowrap'
							/>
						</div>
					</TableRowItem>
				</>
			) : (
				<>
					<TextAccountLink publicKey={accountFrom} />
					<TextAccountLink publicKey={accountTo} />
					<TableRowItem className='col-span-2' position="last">
						<TokenAmount
							amount={new Numeric(BigInt(row.operationSend.amount))}
							tokenPublicKey={row.operationSend.token}
							className='whitespace-nowrap'
						/>

						<Icon type="rotate" className="size-3" />

						<TokenAmount
							amount={new Numeric(BigInt(row.operationForward.amount))}
							tokenPublicKey={row.operationForward.token}
							className='whitespace-nowrap'
						/>
					</TableRowItem>
				</>
			)}
		</>
	)
}

function renderRowTOKEN_ADMIN_SUPPLY(row: Operation & { type: "TOKEN_ADMIN_SUPPLY" }) {
	return (
		<>
			<TextTokenLink publicKey={row.block.account} />
			<TableRowItem className='col-span-4' position="last">
				<div className="flex items-center gap-1.5">
					<Typography size="sm">{getAdjustMethodName(row.operation.method)}</Typography>
					<TokenAmount
						amount={new Numeric(BigInt(row.operation.amount))}
						tokenPublicKey={row.block.account}
						className='whitespace-nowrap'
					/>
				</div>
			</TableRowItem>
		</>
	)
}

function renderRowTOKEN_ADMIN_MODIFY_BALANCE(row: Operation & { type: "TOKEN_ADMIN_MODIFY_BALANCE" }) {
	return (
		<>
			<TextTokenLink publicKey={row.operation.token} />
			<TextAccountLink publicKey={row.block.account} />
			<div className="flex items-center gap-1.5">
				<Typography size="sm">{getAdjustMethodName(row.operation.method)}</Typography>
				<TokenAmount
					amount={new Numeric(BigInt(row.operation.amount))}
					tokenPublicKey={row.operation.token}
					className='whitespace-nowrap'
				/>
			</div>
		</>
	)
}

function renderRowCREATE_IDENTIFIER(row: Operation & { type: "CREATE_IDENTIFIER" }) {
	const identifier = Anchor.KeetaNet.lib.Account.fromPublicKeyString(row.operation.identifier)
	return (
		<>
			<TableRowItem className='col-span-6' position="last">
				<Typography size="sm">
					{identifier.isToken() ? "TOKEN" : identifier.isStorage() ? "STORAGE" : "ACCOUNT"}
				</Typography>
				<TextAccountLink publicKey={row.operation.identifier} truncateChars={10} />
			</TableRowItem>
		</>
	)
}

function renderRowSET_INFO(row: Operation & { type: "SET_INFO" }) {
	const account = Anchor.KeetaNet.lib.Account.fromPublicKeyString(row.block.account)
	return (
		<>
			<TableRowItem className='col-span-6' position="last">
				<Typography size="sm">
					{account.isToken() ? "TOKEN" : account.isStorage() ? "STORAGE" : "ACCOUNT"}
				</Typography>
				<TextAccountLink publicKey={row.block.account} truncateChars={10} />
			</TableRowItem>
		</>
	)
}

function renderRowSET_REP(row: Operation & { type: "SET_REP" }) {
	// const account = Anchor.KeetaNet.lib.Account.fromPublicKeyString(row.block.account)
	return (
		<>
			<TextAccountLink publicKey={row.block.account} />
			<TableRowItem className='col-span-4' position="last">
				<Typography size="sm">
					{/* {account.isToken() ? "TOKEN" : account.isStorage() ? "STORAGE" : "ACCOUNT"} */}
					REP
				</Typography>
				<TextAccountLink publicKey={row.operation.to} truncateChars={10} />
			</TableRowItem>
		</>
	)
}

function renderRowMANAGE_CERTIFICATE(row: Operation & { type: "MANAGE_CERTIFICATE" }) {
	return (
		<>
			<TextAccountLink publicKey={row.block.account} />
			<TableRowItem className='col-span-4' position="last">
				<Typography size="sm">
					{getAdjustMethodName(row.operation.method)}
				</Typography>
				<TextCertificateLink account={row.block.account} hash={row.operation.certificateOrHash} truncateChars={8} />
			</TableRowItem>
		</>
	)
}

function renderRowMODIFY_PERMISSIONS(row: Operation & { type: "MODIFY_PERMISSIONS" }) {
	return (
		<>
			<TextAccountLink publicKey={row.block.account} />
			<TextAccountLink publicKey={row.operation.principal} />
			<Typography size="sm">
				{getAdjustMethodName(row.operation.method)}
			</Typography>
		</>
	)
}

function renderRowUNKNOWN(row: Operation) {
	return (
		<>
			<TableRowItem className='col-span-6' position="last">
				{' '}
			</TableRowItem>
		</>
	)
}

const mapRenderers: { [key in Operation['type']]: (row: any) => ComponentChildren } = {
	SEND: renderRowSEND,
	RECEIVE: renderRowRECEIVE,
	TOKEN_ADMIN_SUPPLY: renderRowTOKEN_ADMIN_SUPPLY,
	TOKEN_ADMIN_MODIFY_BALANCE: renderRowTOKEN_ADMIN_MODIFY_BALANCE,
	CREATE_IDENTIFIER: renderRowCREATE_IDENTIFIER,
	SET_INFO: renderRowSET_INFO,
	SWAP: renderRowSWAP,
	SWAP_FORWARD: renderRowSWAP_FORWARD,
	SET_REP: renderRowSET_REP,
	MODIFY_PERMISSIONS: renderRowMODIFY_PERMISSIONS,
	MANAGE_CERTIFICATE: renderRowMANAGE_CERTIFICATE,
	UNKNOWN: renderRowUNKNOWN
}

const renderRow = (row: Operation) => {
	return(
		<Fragment key={crypto.randomUUID()}>
			<TextBlockLink blockhash={row.block.$hash} />
			<Typography size="sm" className='text-slate-800 opacity-70'>
				{dayjs(row.block.date).fromNow()}
			</Typography>
			<Typography size="sm">
				{row.type}
			</Typography>
			{mapRenderers?.[row.type](row as any) || renderRowUNKNOWN(row)}
		</Fragment>
	);
};

export function TransactionsTable({ operations, className }: TransactionsTableProps) {
	return(<Table
		rows={operations}
		className={className}
		columns={columns}
		renderRow={renderRow}
	/>);
}
