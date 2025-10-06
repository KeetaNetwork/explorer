import { twMerge } from 'tailwind-merge';

import middleSubstring from '@/helpers/middleSubstring';

import { CopyButton } from './CopyButton';
import { Typography } from '@keetanetwork/web-ui';

type TextLinkProps = {
	id: string
	href: string
	className?: string
	truncateChars?: number | null
};

export function TextLink({ id, href, className, truncateChars }: TextLinkProps) {
	return(<div className={twMerge('flex items-center gap-1 shrink-0', className)}>
		<a href={href} className='text-functional-focused'>
			<Typography size="sm" weight='semibold'>
				{truncateChars ? middleSubstring(id, truncateChars) : id}
			</Typography>
		</a>
		<CopyButton text={id} />
	</div>);
}
