import type { ReactNode } from 'react';
import { Fragment } from 'react';


import { TableRowItem } from './Table';
import { TextAccountLink } from './TextAccountLink';
import { TextRepLink } from './TextRepLink';
import { TextTokenLink } from './TextTokenLink';
import TokenAmount from './TokenAmount';
import { Typography } from '@keetanetwork/web-ui';
import { TextCertificateLink } from './TextCertificateLink';
import { ExplorerClientSDK } from '@/libs/explorer-sdk';

type ListTransactionResponse = Awaited<ReturnType<typeof ExplorerClientSDK.prototype.transactions.listByAccount>>

type AccountTransaction = ListTransactionResponse['transactions'][number];

export function OperationType({ transaction }: { transaction: AccountTransaction }): ReactNode {
	switch (transaction.operationType) {
		case 'SEND': {
			return(<Fragment>
				<Typography size="sm">{transaction.operationType}</Typography>
				<TextAccountLink publicKey={transaction.$account ?? ''} />
				<TextAccountLink publicKey={transaction.address} />
				<TokenAmount
					amount={transaction.amount}
					tokenPublicKey={transaction.tokenPublicKey}
					className='whitespace-nowrap'
				/>
			</Fragment>);
		}

		case 'RECEIVE': {
			return(<Fragment>
				<Typography size="sm">{transaction.operationType}</Typography>
				<TextAccountLink publicKey={transaction.address} />
				<TextAccountLink publicKey={transaction.$account ?? ''} />
				<TokenAmount
					amount={transaction.amount}
					tokenPublicKey={transaction.tokenPublicKey}
					className='whitespace-nowrap'
				/>
			</Fragment>);
		}

		case 'TOKEN_ADMIN_SUPPLY':
		case 'TOKEN_ADMIN_MODIFY_BALANCE': {
			return(<Fragment>
				<TableRowItem className='col-span-4'>
					<Typography size="sm">{transaction.operationType}</Typography>
				</TableRowItem>
				<TextTokenLink publicKey={transaction.tokenPublicKey} prefix='Token:' />
				<TableRowItem className='col-span-2' position='last'>
					<TokenAmount
						amount={transaction.amount}
						tokenPublicKey={transaction.tokenPublicKey}
						className='whitespace-nowrap'
					/>
				</TableRowItem>
			</Fragment>);
		}

		case 'SET_INFO': {
			return(<Fragment>
				<Typography size="sm">{transaction.operationType}</Typography>
				<TableRowItem className='col-span-6'>
					<TextTokenLink publicKey={transaction.tokenPublicKey} truncateChars={16} prefix='Token:' />
				</TableRowItem>
			</Fragment>);
		}

		case 'SET_REP': {
			return(<Fragment>
				<Typography size="sm">{transaction.operationType}</Typography>
				<TableRowItem className='col-span-6'>
					<TextRepLink publicKey={transaction.address} truncateChars={24} />
				</TableRowItem>
			</Fragment>);
		}

		case 'MODIFY_PERMISSIONS':
		case 'CREATE_IDENTIFIER': {
			return(<Fragment>
				<TableRowItem className='col-span-8'>
					<Typography size="sm">{transaction.operationType}</Typography>
				</TableRowItem>
			</Fragment>);
		}

		case 'MANAGE_CERTIFICATE': {
			return(<Fragment>
				<TableRowItem className='col-span-4'>
					<Typography size="sm">{transaction.operationType}</Typography>
				</TableRowItem>
				<TableRowItem className='col-span-4'>
					<Typography size="sm">{transaction.method}</Typography>
					<TextCertificateLink hash={transaction.hash} account={transaction.account} />
				</TableRowItem>
			</Fragment>);
		}

		default: {
			console.warn('Unknown transaction type:', transaction);
			return;
		}
	}
}
