import {
    memo,
    type AnchorHTMLAttributes,
    type ButtonHTMLAttributes,
    type DetailedHTMLProps,
    type PropsWithChildren
} from 'react';

import { twMerge } from 'tailwind-merge';

import type { IconProps } from '@/components/core/Icon';
import Icon from '@/components/core/Icon';
import LoaderCircular from '@/components/core/LoaderCircular';
import type { TypographyProps } from '@/components/core/Typography';
import Typography from '@/components/core/Typography';

type ButtonColor = 'neutral' | 'error' | 'success' | 'light';
type ButtonSize = 'small' | 'medium';
// type ButtonSize = 'small' | 'medium' | 'large';
type ButtonVariant = 'contained' | 'outlined' | 'text';

const commonClasses = twMerge([
	'grid',
	'grid-flow-col',
	'content-center',
	'gap-2',
	'border',
	'focus:border-functional-focus',
	'transition-all',
	'items-center'
]);

const buttonVariant: { [key in ButtonVariant]: string } = {
	contained: commonClasses,
	outlined: commonClasses,
	text: 'flex gap-2 items-center justify-between'
};

const buttonSizeClass: { [key in ButtonSize]: string } = {
	small: 'px-4 py-2 rounded-full',
	medium: 'px-6 py-3 rounded-xl'
	// large: 'px-8 py-5 rounded-2xl'
};

const buttonColorVariant: {
	[keyColor in ButtonColor]: { [keyVariant in ButtonVariant]?: string };
} = {
	neutral: {
		contained: twMerge(
			'border-neutral-main',
			'bg-neutral-main',
			'text-foreground-main',
			'disabled:bg-functional-opacity-50',
			'disabled:border-functional-opacity-5',
			'hover:bg-extended-text-80'
		),
		outlined: twMerge(
			'border-neutral-main',
			'hover:enabled:bg-functional-opacity-5',
			'disabled:opacity-50'
		)
	},
	error: {
		contained: twMerge(
			'bg-functional-error',
			'text-neutral-secondary',
			'border-functional-error',
			'disabled:opacity-30'
		),
		outlined: twMerge(
			'border-functional-error',
			'focus:border-functional-error',
			'text-functional-error',
			'disabled:opacity-30'
		),
		text: twMerge('text-functional-error')
	},
	success: {
		contained: twMerge(
			'bg-functional-success',
			'text-neutral-secondary',
			'border-functional-success',
			'disabled:opacity-30'
		),
		outlined: twMerge(
			'border-functional-success',
			'focus:border-functional-success',
			'text-functional-success',
			'disabled:opacity-30'
		),
		text: twMerge('text-functional-success')
	},
	light: {
		contained: twMerge(
			'border-functional-opacity-5',
			'bg-functional-opacity-5',
			'text-neutral-main',
			'disabled:opacity-50',
			'disabled:hover:bg-functional-opacity-5',
			'hover:bg-functional-opacity-10'
		)
	}
};

const typographySizeVariant: { [key in ButtonSize]: TypographyProps['variant'] } = {
	small: 'button2',
	medium: 'button2'
	// large: 'button1'
};

const iconButtonSize: { [key in ButtonSize]: IconProps['size'] } = {
	small: 20,
	medium: 24
	// large: 24
};

export type ButtonProps = PropsWithChildren & {
	autoFocus?: boolean;
	className?: string;
	color?: ButtonColor;
	disabled?: boolean;
	href?: string;
	icon?: IconProps['type'];
	iconSize?: IconProps['size'];
	iconPosition?: 'left' | 'right';
	loading?: boolean;
	size?: ButtonSize;
	target?: DetailedHTMLProps<
	AnchorHTMLAttributes<HTMLAnchorElement>,
	HTMLAnchorElement
	>['target'];
	type?: DetailedHTMLProps<
	ButtonHTMLAttributes<HTMLButtonElement>,
	HTMLButtonElement
	>['type'];
	typographyVariant?: TypographyProps['variant'];
	variant?: ButtonVariant;
	onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

const Button: React.FC<ButtonProps> = ({
	autoFocus,
	children,
	className,
	color = 'neutral',
	disabled,
	href,
	icon,
	iconSize,
	iconPosition = 'left',
	loading,
	size = 'small',
	target,
	type = 'button',
	typographyVariant,
	variant = 'contained',
	onClick
}) => {
	const classes = twMerge(
		'relative',
		buttonSizeClass[size],
		buttonVariant[variant],
		icon && 'button-icon',
		buttonColorVariant[color][variant],
		className
	);

	iconSize = iconSize ?? iconButtonSize[size];

	const iconComponent = icon && (
		<Icon
			type={icon}
			size={iconSize}
			className={twMerge([loading && 'invisible'])}
		/>
	);

	const childrenComponent = children && (
		<Typography
			variant={typographyVariant ?? typographySizeVariant[size]}
			className={twMerge('whitespace-nowrap', loading && 'invisible')}
		>
			{children}
		</Typography>
	);

	const renderIconChildren =
		iconPosition === 'left' ? (
			<>
				{iconComponent}
				{childrenComponent}
			</>
		) : (
			<>
				{childrenComponent}
				{iconComponent}
			</>
		);

	const label = (
		<>
			{renderIconChildren}
			<LoaderCircular
				size={iconSize}
				className={loading ? 'absolute-centralized' : 'hidden'}
			/>
		</>
	);

	if (href && !disabled && !loading) {
		return(<a
			href={href}
			className={classes}
			autoFocus={autoFocus}
			target={target}
		>
			{label}
		</a>);
	}

	return(<button
		type={type}
		className={classes}
		disabled={!!disabled || !!loading}
		onClick={onClick}
		autoFocus={autoFocus}
	>
		{label}
	</button>);
};

function propsAreEqual(
	prevProps: ButtonProps,
	nextProps: ButtonProps
): boolean {
	return(prevProps.disabled === nextProps.disabled &&
		prevProps.loading === nextProps.loading &&
		prevProps.className === nextProps.className &&
		prevProps.icon === nextProps.icon);
}
export default memo(Button, propsAreEqual);
