import { twMerge } from 'tailwind-merge';
import Icon from '@/components/core/Icon';
import Typography from '@/components/core/Typography';
import ErrorPage from '@/app/error';
import { CopyButton } from '@/components/CopyButton';
import PageContent from '@/components/layout/PageContent';
import { PageLoader } from '@/components/layout/PageLoader';
import { useToken } from '@/hooks/useToken';
import Transactions from '@/components/Transactions';
import { ContentCard } from '@/components/ContentCard';

export default function TokenPage({ params: { tokenPublicKey }}: { params: { tokenPublicKey: string }}) {
	const { data, isLoading, isError } = useToken(tokenPublicKey);

	if (isError) {
		return(<ErrorPage />);
	}

	if (!data || isLoading) {
		return(<PageLoader />);
	}

	const { token } = data;

	return(<PageContent>
		<div className='flex flex-col gap-4 mb-6 md:mb-10'>
			<div className='flex gap-2 text-white items-center opacity-50 md:opacity-100'>
				<Icon type='token' size={16} />

				<Typography
					className="capitalize md:uppercase"
					variant="overline1"
				>
					Token
				</Typography>
			</div>

			<div className='flex flex-col gap-4 md:gap-1'>
				<Typography
					variant='h6'
					className={twMerge(
						'text-white shrink max-w-[calc(100%-40px)] font-normal',
						'md:text-[18px] md:font-semibold'
					)}
				>
					{`${token.name} (${token.currencyCode})`}
				</Typography>

				<div className='flex items-center gap-3'>
					<Typography
						variant='h6'
						className={twMerge(
							'text-white max-w-[calc(100%-40px)] opacity-70 md:opacity-50 text-[12px] md:text-[16px]'
						)}
					>
						{token.publicKey}
					</Typography>
					<CopyButton text={token.publicKey} iconSize={24} />
				</div>
			</div>
		</div>

		<div className='flex flex-col gap-8'>
			<ContentCard
				title="Details"
				content={[
					{ label: "Name", value: token.name },
					{ label: "Symbol", value: token.currencyCode },
					{ label: "Supply", value: token.supply.toDecimalString(token.decimalPlaces, true, true) },
					{ label: "Decimal Places", value: token.decimalPlaces },
					{ label: "Access Mode", value: token.accessMode },
					{ label: "Default Permissions", value: token.defaultPermissions.join(',') },
				]}
			/>

			<Transactions publicKey={tokenPublicKey} variant='token' />
		</div>
	</PageContent>);
}
