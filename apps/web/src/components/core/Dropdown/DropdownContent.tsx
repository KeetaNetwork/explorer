import type { PropsWithChildren } from 'react';

import { twMerge } from 'tailwind-merge';

type DropdownContentProps = PropsWithChildren & {
	className?: string;
};

const DropdownContent: React.FC<DropdownContentProps> = ({ className, children }) => (
	<div
		className={twMerge(
			'bg-neutral-secondary dropdown-content rounded-lg border border-extended-text-20 py-2 flex flex-col',
			className
		)}
	>
		{children}
	</div>
);

export default DropdownContent;
