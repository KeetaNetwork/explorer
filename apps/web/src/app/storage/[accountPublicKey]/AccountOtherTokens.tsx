import { Fragment } from 'react';


import Typography from '@/components/core/Typography';

import type { TableColumn } from '@/components/Table';
import { TextTokenLink } from '@/components/TextTokenLink';
import TokenAmount from '@/components/TokenAmount';
import { TableCard } from '@/components/TableCard';
import { ExplorerClientSDK } from '@/libs/explorer-sdk';

type GetAccountDetailsResponse = Awaited<ReturnType<typeof ExplorerClientSDK.prototype.account.details>>;

const columns: TableColumn[] = [
	{ title: 'Name' },
	{ title: 'Token Address' },
	{ title: 'Amount' }
];

function renderRow(row: GetAccountDetailsResponse['account']['tokens'][number]) {
	return(<Fragment key={crypto.randomUUID()}>
		<Typography variant='text1' className='whitespace-nowrap'>{row.name}</Typography>
		<TextTokenLink publicKey={row.publicKey} truncateChars={10} />
		<TokenAmount
			amount={row.balance}
			tokenPublicKey={row.publicKey}
			tokenInfo={row}
		/>
	</Fragment>);
}

export function AccountOtherTokens({ tokens }: { tokens: GetAccountDetailsResponse['account']['tokens'] }) {
	return(
		<TableCard<GetAccountDetailsResponse['account']['tokens'][number]>
			hasToggle
			title={`Other Tokens (${tokens.length})`}
			columns={columns}
			rows={tokens}
			renderRow={renderRow}
			// className={twMerge(
			// 	'overflow-auto max-h-[400px] border-t border-slate-100',
			// 	' md:max-h-[300px] md:border-t-0 md:divide-y md:divide-slate-100'
			// )}
		/>
	)
}
