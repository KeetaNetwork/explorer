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
import { asContractOperation, formatBytes, formatInteger, type ContractOperationJSON } from '@/helpers/contract';
import middleSubstring from '@/helpers/middleSubstring';

type GetVoteStapleResponse = Awaited<ReturnType<typeof ExplorerClientSDK.prototype.network.getVoteStaple>>

type Block = GetVoteStapleResponse['voteStaple']['blocks'][number];

const columns: TableColumn[] = [
	{ title: 'Type' },
	{ title: 'Address' },
	{ title: 'Amount' }
];

/**
 * Contract operations: a deploy names the new contract, a call the
 * contract it calls, an order the calls its sequencer ordered and the
 * contracts they call. An order with no calls pins its contract's chain for
 * the staple's calls, which read or change its state.
 */
function renderContractOperation(operation: ContractOperationJSON) {
	switch (operation.name) {
		case 'CONTRACT_DEPLOY':
			return(<Fragment>
				<Typography size="sm">{operation.name}</Typography>
				<TextAccountLink publicKey={operation.contract} truncateChars={16} />
				<Typography size="sm">{formatBytes(operation.codeSize)} of code</Typography>
			</Fragment>);
		case 'CONTRACT_CALL':
			return(<Fragment>
				<Typography size="sm">{operation.name}</Typography>
				<TextAccountLink publicKey={operation.contract} truncateChars={16} />
				<span title={operation.data}>
					<Typography size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>
						{operation.data.length > 0 ? `0x${middleSubstring(operation.data, 6)}` : 'no data'}, gas limit {formatInteger(operation.gasLimit)}
					</Typography>
				</span>
			</Fragment>);
		case 'CONTRACT_ORDER':
			return(<Fragment>
				<TableRowItem className='col-span-4' position='first'>
					<Typography size="sm">{operation.name}</Typography>
				</TableRowItem>
				<TableRowItem className='col-span-8'>
					{operation.calls.length === 0 ? (
						<Fragment>
							<Typography size="sm">
								No calls of its own: it pins this contract&apos;s chain for {(operation.calledContracts ?? []).length > 0 ? 'the call to' : 'a call elsewhere in this staple'}
							</Typography>
							{(operation.calledContracts ?? []).map(contract => <TextAccountLink key={contract} publicKey={contract} truncateChars={16} />)}
						</Fragment>
					) : (
						<Fragment>
							<Typography size="sm">{operation.calls.length} call{operation.calls.length === 1 ? '' : 's'} in order:</Typography>
							{operation.calls.map((call, index) => (
								<div key={index} className='flex items-center gap-2'>
									<Typography size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{middleSubstring(call.block, 4)}#{call.operationIndex}</Typography>
									{call.contract !== undefined && <TextAccountLink publicKey={call.contract} truncateChars={16} />}
								</div>
							))}
						</Fragment>
					)}
				</TableRowItem>
			</Fragment>);
	}
}

const renderRow = (transaction: Block['operations'][number]) => {
	const contractOperation = transaction.type === 'UNKNOWN' ? asContractOperation(transaction.operation) : null;
	if (contractOperation) {
		return(renderContractOperation(contractOperation));
	}

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
