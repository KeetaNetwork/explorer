import { Icon, Typography } from "@keetanetwork/web-ui";
import Paper from "./core/Paper";
import { ComponentChildren } from "preact";
import { twMerge } from "tailwind-merge";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "preact/hooks";

export interface CardContainerProps {
	title: string;
	className?: string;
	hasToggle?: boolean | "open";
	titleClassName?: string;
	contentClassName?: string;
};

export function CardContainer({ title, children, className, hasToggle, titleClassName, contentClassName }: CardContainerProps & { children: ComponentChildren }) {
	const [isOpen, setIsOpen] = useState(hasToggle ? (hasToggle === "open") : true);

	const handleClick = () => {
		if (hasToggle) {
			setIsOpen(prev => !prev);
		}
	}

	return (
		<Paper className={className}>
			<div className={twMerge(`px-4 py-5 flex items-center rounded-t-lg justify-between ${hasToggle ? 'cursor-pointer' : ''}`, titleClassName)} onClick={handleClick}>
				<Typography font="expanded" weight="bold" size="sm">{title}</Typography>

				{hasToggle && (
					<Icon type="chevron-down" className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
				)}
			</div>

			<AnimatePresence mode="wait">
				{isOpen && (
					<motion.div
						className={twMerge("divide-y divide-slate-100 border-t border-slate-100 overflow-hidden [&>*]:last:rounded-b-lg", contentClassName)}
						initial={{ opacity: 0, height: 0 }}
						animate={{ opacity: 1, height: 'auto' }}
						exit={{ opacity: 0, height: 0 }}
					>
						{children}
					</motion.div>
				)}
			</AnimatePresence>
		</Paper>
	)
}
