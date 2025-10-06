import React from 'react';
import type { JSX } from 'preact';

import { twMerge } from 'tailwind-merge';

import styles from './Dropdown.module.css';
import DropdownButton from './DropdownButton';
import DropdownContent from './DropdownContent';

type DropdownProps = React.PropsWithChildren & {
	button: JSX.Element;
	buttonClassName?: string;
	className?: string;
	content: JSX.Element | JSX.Element[];
	contentClassName?: string;
};

const Dropdown: React.FC<DropdownProps> = ({ button, buttonClassName, className, content, contentClassName }) => (
	<div className={twMerge(styles.dropdown, className)}>
		<div className={twMerge(styles.button, buttonClassName)}>
			{button}
		</div>
		<div className={twMerge(styles.content, contentClassName)} role="dialog" aria-modal="true">
			{content}
		</div>
	</div>
);

export default Dropdown;
export { DropdownContent, DropdownButton };
