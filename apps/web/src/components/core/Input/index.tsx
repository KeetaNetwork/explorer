import type { InputHTMLAttributes, ReactNode } from 'react';
import { forwardRef } from 'react';

import { twMerge } from 'tailwind-merge';

import { VARIANTS } from '@/components/core/Typography';

type HTMLInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'children'>;

export type InputProps = HTMLInputProps & {
	adornment?: ReactNode;
	adornmentPosition?: 'left' | 'right';
	className?: string;
	error?: boolean;
};

const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{ adornment, adornmentPosition = 'right', className, error, ...props },
		forwardedRef
	) => {
		const input = (
			<input
				ref={forwardedRef}
				className={twMerge(
					'border px-4 py-2 rounded-lg',
					error && 'border-functional-error',
					adornmentPosition === 'left' && !!adornment && 'pl-12 w-full',
					adornmentPosition === 'right' && !!adornment && 'pr-10 w-full',
					VARIANTS.text1,
					className
				)}
				{...props}
			/>
		);

		if (adornment) {
			return(<div className="relative">
				{adornmentPosition === 'left' && (
					<span className="absolute-y-centralized left-4">{adornment}</span>
				)}
				{input}
				{adornmentPosition === 'right' && (
					<span className="absolute-y-centralized right-4">{adornment}</span>
				)}
			</div>);
		}

		return(input);
	}
);
Input.displayName = 'Input';

export default Input;
