import React from 'react';

import { twMerge } from 'tailwind-merge';

interface PageContentProps extends React.PropsWithChildren {
	className?: string;
	hasPaddingHorizontal?: boolean;
	hasPaddingVertical?: boolean;
}

const PageContent: React.FC<PageContentProps> = ({
	className,
	children,
	hasPaddingHorizontal = true,
	hasPaddingVertical = false
}) => (
	<div
		className={twMerge(
			'container max-w-[1068px] mx-auto min-w-[340px]',
			hasPaddingHorizontal && 'px-4 sm:px-8',
			hasPaddingVertical && 'py-8',
			className
		)}
	>
		{children}
	</div>
);

export default PageContent;
