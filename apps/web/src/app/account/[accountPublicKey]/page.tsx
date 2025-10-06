
import { useQuery } from '@preact-signals/query';

import { useClientSDK } from '@/providers/ClientProvider';
import { PageLoader } from '@/components/layout/PageLoader';
import PageContent from '@/components/layout/PageContent';
import { twMerge } from 'tailwind-merge';
import DEPRECATED_Typography from '@/components/core/Typography';
import { CopyButton } from '@/components/CopyButton';
import { AccountOtherTokens } from './AccountOtherTokens';
import NotFoundPage from '@/app/not-found';

import { ContentCard } from '@/components/ContentCard';

import { Transactions } from '@/components/Transactions';
import { TableCard } from '@/components/TableCard';
import { TextCertificateLink } from '@/components/TextCertificateLink';
import { completeDay } from '@/helpers/date';
import { Typography } from '@keetanetwork/web-ui';
import { Fragment } from 'preact/jsx-runtime';
import { TextAccountLink } from '@/components/TextAccountLink';

export default function AccountPage({ params: { accountPublicKey }}: { params: { accountPublicKey: string }}) {
	const sdk = useClientSDK();
	const { data, isLoading, isError } = useQuery({
		queryKey: ['account', accountPublicKey, 'details'],
		queryFn: () => sdk.account.details(accountPublicKey),
	});

	if (isError) {
		return(<NotFoundPage />);
	}

	if (!data || isLoading) {
		return(<PageLoader />);
	}

	const { account } = data;

	const keetaToken = account.tokens.find(({ type }) => type === "BASE");
	const otherTokens = keetaToken
		? account.tokens.filter(({ publicKey }) => publicKey !== keetaToken.publicKey)
		: account.tokens;

	return(<PageContent>
		<div className='flex flex-col gap-4 mb-4 md:mb-10 w-full'>
			<div className='flex gap-2'>
				<DEPRECATED_Typography className="text-white hidden md:block" variant="overline1">
					#
				</DEPRECATED_Typography>

				<DEPRECATED_Typography
					className="opacity-50 md:opacity-100 text-white capitalize md:uppercase"
					variant="overline1"
				>
					Address
				</DEPRECATED_Typography>
			</div>

			<div className='flex flex-col gap-4 md:gap-1'>
				<div className='flex items-center gap-3'>
					<DEPRECATED_Typography
						variant='h6'
						className={twMerge(
							'text-white shrink max-w-[calc(100%-40px)] font-normal',
							'md:text-[18px] md:font-semibold'
						)}
					>
						{account.publicKey}
					</DEPRECATED_Typography>
					<CopyButton text={account.publicKey} iconSize={24} />
				</div>

				<div className='md:hidden border-b border-b-white/10' />

				<div className={twMerge(
					'bg-white/5 px-5 py-3 rounded-xl flex flex-col gap-1',
					' md:flex-row md:items-center md:p-0 md:bg-white/0'
				)}>
					<DEPRECATED_Typography
						variant='body3'
						className={
							'text-white opacity-70 md:opacity-50 text-[12px] uppercase md:normal-case md:text-[16px]'
						}
					>
						Keeta Balance
					</DEPRECATED_Typography>
					<DEPRECATED_Typography
						variant='body3'
						className='text-white md:opacity-50 text-[18px] font-semibold md:text-[16px] md:font-normal'
					>
						{keetaToken ? keetaToken.balance.toDecimalString(keetaToken.decimalPlaces, true, true) : '0'}
					</DEPRECATED_Typography>
				</div>
			</div>
		</div>

		<div className='flex flex-col gap-8'>
			<ContentCard
				title="Details"
				content={[
					{ label: "Type", value: account.type },
					{ label: "Delegated to", type: "account", value: account.representative },
					{ label: "Name", value: account.info.name },
					{ label: "Description", value: account.info.description },
					{ label: "Quorum", value: account.info.multisigQuorum },
				]}
			/>

			{otherTokens.length > 0 && (<AccountOtherTokens tokens={otherTokens} />)}

			{account.signers && (
				<TableCard<typeof account.signers[number]>
					hideHeader
					title={`Signers (${account.signers.length})`}
					columns={[
						{ title: 'Account' },
					]}
					rows={account.signers}
					renderRow={row => (
						<Fragment key={row}>
							<TextAccountLink publicKey={row} truncateChars={null} />
						</Fragment>
					)}
				/>
			)}

			<TableCard<typeof account.certificates[number]>
				hasToggle
				title={`Certificates (${account.certificates.length})`}
				columns={[
					{ title: 'Issuer', size: 5 },
					{ title: 'Certificate Address', size: 3 },
					{ title: 'Issued on', size: 2 },
					{ title: 'Valid until', size: 2 },
				]}
				rows={account.certificates}
				renderRow={row => (
					<Fragment key={row.hash}>
						<Typography size="sm">{row.issuer}</Typography>
						<TextCertificateLink hash={row.hash} account={account.publicKey} truncateChars={6} />
						<Typography size="sm">{completeDay(row.issuedAt)}</Typography>
						<Typography size="sm">{completeDay(row.expiresAt)}</Typography>
					</Fragment>
				)}
			/>

			<Transactions publicKey={account.publicKey} variant='default' />
		</div>
	</PageContent>);
}
