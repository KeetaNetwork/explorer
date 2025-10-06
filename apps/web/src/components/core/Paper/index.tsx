
import type React from 'react';

import { twMerge } from 'tailwind-merge';

import Typography from '@/components/core/Typography';

interface PaperProps extends React.PropsWithChildren {
	className?: string;
	hasPaddingHorizontal?: boolean;
	hasPaddingVertical?: boolean;
	hasDividerHorizontal?: boolean;
}

const Paper: React.FC<PaperProps> = ({
	className,
	children,
	hasPaddingHorizontal = false,
	hasPaddingVertical = false,
	hasDividerHorizontal = false
}) => (
	<div
		className={twMerge([
			'bg-white rounded-lg border border-slate-100',
			hasPaddingHorizontal && 'px-4',
			hasPaddingVertical && 'py-4',
			hasDividerHorizontal && 'divide-y divide-slate-100',
			className
		])}
	>
		{children}
	</div>
);

export default Paper;

export function PaperTitle(
	{ hasPadding, className, children }: { hasPadding?: boolean; className?: string; children: string | string[] }
) {
	return(<Typography
		variant='text1-bold'
		className={twMerge(hasPadding && 'px-4 py-5 box', className)}
	>{children}</Typography>);
}
