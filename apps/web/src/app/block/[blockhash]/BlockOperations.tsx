import { Fragment } from 'react';

import { TableRowItem, type TableColumn } from '@/components/Table';
import { TextAccountLink } from '@/components/TextAccountLink';
import { TextRepLink } from '@/components/TextRepLink';
import { TextTokenLink } from '@/components/TextTokenLink';
import TokenAmount from '@/components/TokenAmount';
import { TableCard } from '@/components/TableCard';
import { Typography } from '@keetanetwork/web-ui';
import { TextCertificateLink } from '@/components/TextCertificateLink';
import type { ExplorerClientSDK } from '@/libs/explorer-sdk';
import { getCertificateHash } from '@keetanetwork/web-ui/helpers/keetanet-operations';
import { Numeric } from '@keetanetwork/web-ui/helpers/Numeric';

type GetVoteStapleResponse = Awaited<ReturnType<typeof ExplorerClientSDK.prototype.network.getVoteStaple>>

type Block = GetVoteStapleResponse['voteStaple']['blocks'][number];

const columns: TableColumn[] = [
	{ title: 'Type' },
	{ title: 'Address' },
	{ title: 'Amount' }
];

const renderRow = (transaction: Block['operations'][number]) => {
	switch (transaction.type) {
		case 'SEND': {
			return(<Fragment>
				<Typography size="sm">{transaction.type}</Typography>
				<TextAccountLink publicKey={transaction.operation.to} truncateChars={16} />
				<TokenAmount
					amount={new Numeric(BigInt(transaction.operation.amount))}
					tokenPublicKey={transaction.operation.token}
				/>
			</Fragment>);
		}

		case 'RECEIVE': {
			return(<Fragment>
				<Typography size="sm">{transaction.type}</Typography>
				<TextAccountLink publicKey={transaction.operation.from} truncateChars={16} />
				<TokenAmount
					amount={new Numeric(BigInt(transaction.operation.amount))}
					tokenPublicKey={transaction.operation.token}
				/>
			</Fragment>);
		}

		case 'TOKEN_ADMIN_SUPPLY': {
			return(<Fragment>
				<Typography size="sm">{transaction.type}</Typography>
				<TextTokenLink publicKey={transaction.block.account} prefix='Token:' truncateChars={8} />
				<TokenAmount
					amount={new Numeric(BigInt(transaction.operation.amount))}
					tokenPublicKey={transaction.block.account}
				/>
			</Fragment>);
		}

		case 'TOKEN_ADMIN_MODIFY_BALANCE': {
			return(<Fragment>
				<Typography size="sm">{transaction.type}</Typography>
				<TextTokenLink publicKey={transaction.operation.token} prefix='Token:' truncateChars={8} />
				<TokenAmount
					amount={new Numeric(BigInt(transaction.operation.amount))}
					tokenPublicKey={transaction.operation.token}
				/>
			</Fragment>);
		}

		case 'SET_INFO': {
			return(<Fragment>
				<Typography size="sm">{transaction.type}</Typography>
				<TableRowItem className='col-span-8'>
					<TextTokenLink publicKey={transaction.block.account} truncateChars={16} prefix='Token:' />
				</TableRowItem>
			</Fragment>);
		}

		case 'SET_REP': {
			return(<Fragment>
				<Typography size="sm">{transaction.type}</Typography>

				<TableRowItem className='col-span-8'>
					<TextRepLink publicKey={transaction.operation.to} truncateChars={24} />
				</TableRowItem>
			</Fragment>);
		}

		case 'MODIFY_PERMISSIONS':
		case 'CREATE_IDENTIFIER': {
			return(<Fragment>
				<TableRowItem className='col-span-12' position='first'>
					<Typography size="sm">{transaction.type}</Typography>
				</TableRowItem>
			</Fragment>);
		}

		case 'MANAGE_CERTIFICATE': {
			return(<Fragment>
				<TableRowItem className='col-span-4' position='first'>
					<Typography size="sm">{transaction.type}</Typography>
				</TableRowItem>
				<TableRowItem className='col-span-8'>
					<Typography size="sm">{transaction.operation.method}</Typography>
					<TextCertificateLink hash={getCertificateHash(transaction.operation as any)} account={transaction.block.account} truncateChars={12} />
				</TableRowItem>
			</Fragment>);
		}

		default: {
			console.warn('Unknown transaction type:', transaction);
			return;
		}
	}
};

export function BlockOperations({ block }: { block: Block }) {
	return(
		<TableCard
			title="Operations"
			columns={columns}
			rows={block.operations}
			renderRow={renderRow}
		/>
	);
}
