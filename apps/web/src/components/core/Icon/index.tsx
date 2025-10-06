import { Suspense, memo } from 'react';

import { twMerge } from 'tailwind-merge';

import styles from './icon.module.css';
import type { IconSize, IconType } from './types';
import { lazy } from 'preact-iso';

export type IconProps = {
	className?: string;
	iconClassName?: string;
	size?: IconSize;
	type: IconType;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadedSvgs: { [key in string]: any } = {};

const dynamicIcon = (type: IconType) => {
	if (!(type in loadedSvgs)) {
		loadedSvgs[type] = lazy(() => import(`./files/${type}.svg?react`));
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return(loadedSvgs[type]);
};

const Icon: React.FC<IconProps> = ({ type, size = 24, className, iconClassName, ...props }) => {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const Component = dynamicIcon(type);

	const width = size;
	const height = size;
	const fontSize = size;

	return(<div className={twMerge(styles.container, className)} style={{ width, height }}>
		<Suspense fallback={<div />}>
			<Component
				style={{ fontSize }}
				className={twMerge(styles.icon, iconClassName)}
				{...props}
			/>
		</Suspense>
	</div>);
};

function isEqualProps(previous: IconProps, next: IconProps): boolean {
	const type = previous.type === next.type;
	const size = previous.size === next.size;
	const className = previous.className === next.className;
	const iconClassName = previous.iconClassName === next.iconClassName;
	return(type && size && className && iconClassName);
}

export default memo(Icon, isEqualProps);
export type { IconType };
