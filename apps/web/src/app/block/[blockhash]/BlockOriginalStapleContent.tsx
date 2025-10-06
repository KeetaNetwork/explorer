import { twMerge } from 'tailwind-merge';

import Icon from '@/components/core/Icon';
import Typography from '@/components/core/Typography';

export function BlockOriginalStapleContent({ content }: { content: string }) {
	return(<div
		className="flex flex-col p-6 gap-2 bg-[#EBEBEB] border border-black/5 rounded-lg border-dashed group relative"
	>
		<Typography variant="h6" className='text-[14px]'>Original Staple Content</Typography>

		<div className={twMerge(
			'break-keep hyphens-auto max-h-[122px] overflow-hidden group-has-[:checked]:overflow-x-auto',
			'group-has-[:checked]:max-h-max group-has-[:checked]:whitespace-pre-wrap',
			'font-mono text-[14px]'
		)}>
			{content}
		</div>
		<div
			className={twMerge(
				'absolute bottom-4 right-4 grid grid-cols-2',
				'bg-gradient-to-br from-white/0 to-[#EBEBEB] via-[rgba(235,235,235,0.8)]'
			)}
		>
			<div />
			<div
				className={twMerge(
					'grid grid-rows-2',
				)}
			>
				<div />
				<label className='px-4 py-2 flex items-center gap-2 cursor-pointer group-has-[:checked]:hidden'>
					<Icon type='chevron-up' className='rotate-180' size={20} />
					<Typography variant='body4-bold'>Expand</Typography>
					<input type="checkbox" className='hidden' />
				</label>
			</div>
		</div>
	</div>);
}
