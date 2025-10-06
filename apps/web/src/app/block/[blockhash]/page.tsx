import dayjs from 'dayjs';
import { twMerge } from 'tailwind-merge';

import Icon from '@/components/core/Icon';
import DEPRECATED_Typography from '@/components/core/Typography';

import { CopyButton } from '@/components/CopyButton';
import PageContent from '@/components/layout/PageContent';

import notFound from '@/app/not-found';
import { useClientSDK } from '@/providers/ClientProvider';
import { useQuery } from '@preact-signals/query';
import { PageLoader } from '@/components/layout/PageLoader';
import NotFoundPage from '@/app/not-found';
import type { ContentItem } from '@/components/ContentCard';
import { ContentCard } from '@/components/ContentCard';
import { IconButton, Typography } from '@keetanetwork/web-ui';
import { useLocation } from 'preact-iso';
import { BlockOperations } from './BlockOperations';
import { TableCard } from '@/components/TableCard';
import { TextValidatorLink } from '@/components/TextValidatorLink';
import { Fragment } from 'preact/jsx-runtime';
import { BlockOriginalStapleContent } from './BlockOriginalStapleContent';
import { getSigners } from '@keetanetwork/web-ui/helpers/keetanet-operations';
import * as Anchor from "@keetanetwork/anchor";
import { TextAccountLink } from '@/components/TextAccountLink';

export default function BlockPage({ params: { blockhash }}: { params: { blockhash: string }}) {
	const sdk = useClientSDK();
	const { route } = useLocation();
	const { data, isLoading, isError } = useQuery({
		queryKey: ['block', blockhash, 'details'],
		queryFn: () => sdk.network.getVoteStaple(blockhash),
	});

	if (isError) {
		return(<NotFoundPage />);
	}

	if (!data || isLoading) {
		return(<PageLoader />);
	}

	const { voteStaple, nextBlockHash, previousBlockHash } = data;

	const currentBlock = voteStaple.blocks.find(({ $hash }) => $hash === blockhash);
	if (!currentBlock) {
		return(notFound());
	}

	const otherBlocks = voteStaple.blocks.filter(({ $hash }) => $hash !== blockhash);
	const signatures = getSigners(currentBlock.signer as any) as unknown as string[]

	return(<PageContent>
		<div className="flex items-center justify-between mb-4 md:mb-10 max-md:flex-col">
			<div className='flex flex-col gap-4 md:w-[calc(100%-76px)] w-full'>
				<div className='flex gap-2 text-white items-center opacity-50 md:opacity-100'>
					<Icon type='block' size={16} />

					<DEPRECATED_Typography
						className="capitalize md:uppercase"
						variant="overline1"
					>
						Block
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
							{blockhash}
						</DEPRECATED_Typography>
						<CopyButton text={blockhash} iconSize={24} />
					</div>

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
							{dayjs(currentBlock.date).toString()}
						</DEPRECATED_Typography>
					</div>
				</div>
			</div>

			<div className={"flex gap-3 justify-end py-4 max-md:w-full"}>
				<IconButton
					disabled={!previousBlockHash}
					type="chevron-left"
					size="small"
					variant='secondary'
					className={twMerge('bg-white/10', !previousBlockHash && 'opacity-50')}
					onClick={() => route(`/block/${previousBlockHash}`)}
				/>
				<IconButton
					disabled={!nextBlockHash}
					type="chevron-right"
					size="small"
					variant='secondary'
					className={twMerge('bg-white/10', !nextBlockHash && 'opacity-50')}
					onClick={() => route(`/block/${nextBlockHash}`)}
				/>
			</div>
		</div>

		<div className='flex flex-col gap-8'>
			{/* Details */}
			<ContentCard
				title="Details"
				content={[
					{ label: 'Version', value: currentBlock.version },
					{ label: 'Purpose', value: Anchor.KeetaNet.lib.Block.Purpose[currentBlock.purpose] },
					{ label: 'Account', type: "account", value: currentBlock.account },
					{ label: `Signer${signatures.length === 0 ? '' : ' (MultiSig)'}`, type: "account", value: signatures[0] },

				]}
			/>

			{signatures.length > 0 && (
				<TableCard<typeof signatures[number]>
					hideHeader
					title={`Signers (${signatures.length - 1})`}
					columns={[
						{ title: 'Account' },
					]}
					rows={signatures.slice(1)}
					renderRow={row => (
						<Fragment key={row}>
							<TextAccountLink publicKey={row} truncateChars={null} />
						</Fragment>
					)}
				/>
			)}

			{/* Operations */}
			<BlockOperations block={currentBlock} />

			{/* Related Blocks on same staple */}
			{otherBlocks.length > 0 && (
				<ContentCard
					hasToggle
					title="Related Staple Blocks"
					content={otherBlocks.map(block => ({
						label: 'Block',
						type: "block",
						value: block.$hash
					}) satisfies ContentItem)}
				/>
			)}

			{/* Validators */}
			<TableCard
				title="Validators"
				rows={voteStaple.votes}
				columns={[
					{ title: 'Time', size: 4 },
					{ title: 'Address', size: 6 },
					{ title: 'Weight', size: 2 }
				]}
				renderRow={vote => (
					<Fragment key={vote.$id}>
						<Typography size="sm">{dayjs(vote.validityFrom).toString()}</Typography>
						<TextValidatorLink publicKey={vote.issuer} truncateChars={16} />
						<Typography size="sm">1</Typography>
					</Fragment>
				)}
			/>

			{/* Original Content */}
			<BlockOriginalStapleContent content={voteStaple.originalContent} />
		</div>
	</PageContent>);
}
