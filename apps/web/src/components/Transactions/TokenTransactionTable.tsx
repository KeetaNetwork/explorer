import Table, { TableRowItem, type TableColumn } from "@/components/Table";
import { TextBlockLink } from "@/components/TextBlockLink";
import { Typography } from "@keetanetwork/web-ui";
import { Fragment } from "preact/jsx-runtime";

import dayjs from "dayjs";
import relativeTime from 'dayjs/plugin/relativeTime';
import { TextAccountLink } from "@/components/TextAccountLink";

import TokenAmount from "@/components/TokenAmount";
import { getAdjustMethodName } from "@/helpers/keetanet";
import { TextTokenLink } from "@/components/TextTokenLink";
import { TextCertificateLink } from "@/components/TextCertificateLink";
import type { ComponentChildren } from "preact";
import type { Operation } from "@/hooks/useTransactions";
import type { TransactionsTableProps } from "./TransactionsTable";
import { Numeric } from "@keetanetwork/web-ui/helpers/Numeric";

dayjs.extend(relativeTime);

const columns: TableColumn[] = [
	{ title: 'Block' },
	{ title: 'Age' },
	{ title: 'Type' },
	{ title: 'Signer' },
	{ title: 'Account' },
	{ title: '' },
];

function renderRowSEND(row: Operation & { type: "SEND" }) {
	return (
		<>
			<TextTokenLink publicKey={row.operation.to} />
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
			<TextTokenLink publicKey={row.block.account} />
			<TokenAmount
				amount={new Numeric(BigInt(row.operation.amount))}
				tokenPublicKey={row.operation.token}
				className='whitespace-nowrap'
			/>
		</>
	)
}

function renderRowSWAP(row: Operation & { type: "SWAP" }) {
	return (
		<>
			<TableRowItem className='col-span-4' position="last">
				{' '}
			</TableRowItem>
		</>
	)
}

function renderRowSWAP_FORWARD(row: Operation & { type: "SWAP_FORWARD" }) {
	return (
		<>
			<TableRowItem className='col-span-4' position="last">
				{' '}
			</TableRowItem>
		</>
	)
}

function renderRowTOKEN_ADMIN_SUPPLY(row: Operation & { type: "TOKEN_ADMIN_SUPPLY" }) {
	return (
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
	)
}

function renderRowTOKEN_ADMIN_MODIFY_BALANCE(row: Operation & { type: "TOKEN_ADMIN_MODIFY_BALANCE" }) {
	return (
		<>
			<TextTokenLink publicKey={row.block.account} />
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
	return (
		<>
			<TableRowItem className='col-span-4' position="last">
				{' '}
			</TableRowItem>
		</>
	)
}

function renderRowSET_INFO(row: Operation & { type: "SET_INFO" }) {
	return (
		<>
			<TableRowItem className='col-span-4' position="last">
				{' '}
			</TableRowItem>
		</>
	)
}

function renderRowSET_REP(row: Operation & { type: "SET_REP" }) {
	return (
		<>
			<TableRowItem className='col-span-4' position="last">
				{' '}
			</TableRowItem>
		</>
	)
}

function renderRowMANAGE_CERTIFICATE(row: Operation & { type: "MANAGE_CERTIFICATE" }) {
	return (
		<>
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
			<TextTokenLink publicKey={row.operation.principal} />
			<Typography size="sm">
				{getAdjustMethodName(row.operation.method)}
			</Typography>
		</>
	)
}

function renderRowUNKNOWN(row: Operation) {
	return (
		<>
			<TableRowItem className='col-span-4' position="last">
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

			{Array.isArray(row.block.signer) ? (
				<TextAccountLink publicKey={row.block.signer[0]} />
			) : (
				<TextAccountLink publicKey={row.block.signer} />
			)}

			{mapRenderers?.[row.type](row as any) || renderRowUNKNOWN(row)}
		</Fragment>
	);
};

export function TokenTransactionTable({ operations, className }: TransactionsTableProps) {
	return(<Table
		rows={operations}
		className={className}
		columns={columns}
		renderRow={renderRow}
	/>);
}
