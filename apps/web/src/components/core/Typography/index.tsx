import type { DetailedHTMLProps, HTMLAttributes, LabelHTMLAttributes } from 'react';

import { twMerge } from 'tailwind-merge';

// import { fontSurtExpanded, fontSurtNormal } from '@/app/_fonts';
import type { PartialRecord } from '@/utils/types';

type ComponentLabelProps = Omit<DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>, 'color' | 'className'>;

type ComponentSpanProps = Omit<DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement>, 'color' | 'className'>;

type TypographyComponent = 'text' | 'label' | 'span';

// Typography component props
interface TypographyBase {
	className?: string;
	variant: TypographyVariant;
	component?: TypographyComponent
}

interface TypographyText extends TypographyBase {
	component?: 'text'
	children: React.ReactNode
}

interface TypographyLabel extends TypographyBase, ComponentLabelProps {
	component: 'label'
}

interface TypographySpan extends TypographyBase, ComponentSpanProps {
	component: 'span'
}

// Variants
type TypographyVariant = keyof typeof VARIANTS;

const DEFAULT_HTML_TAG = 'p';

function customHtmlTagForVariant(variant: TypographyVariant) {
	const map: PartialRecord<TypographyVariant, string> = {
		// h1: 'h1',
		// h2: 'h2',
		// h3: 'h3',
		h4: 'h4',
		// h5: 'h5',
		h6: 'h6'
	};
	return(map[variant] || DEFAULT_HTML_TAG);
}

// Fonts
const fontExpanded = 'font-surt-expanded';
const fontNormal = 'font-surt-normal';

// Responsives
// const displayText = 'desktop:text-[48px] tablet:text-[40px] mobile:text-[32px]';
// const displayLineHeight = 'desktop:leading-[72px] tablet:leading-[64px] mobile:leading-[48px]';

// const h2Text = 'desktop:text-[40px] tablet:text-[40px] mobile:text-[28px]';
// const h2LineHeight = 'desktop:leading-[72px] tablet:leading-[72px] mobile:leading-[48px]';

// const h3Text = 'desktop:text-[32px] tablet:text-[32px] mobile:text-[24px]';

const VARIANT_PLAIN = {
	'body4': `${fontNormal} text-[14px] leading-[24px] tracking-[0.015em]`
};

// Variants
export const VARIANTS = {
	// 'display': `${fontExpanded} font-medium ${displayText} ${displayLineHeight} tracking-[-0.01em]`,
	// 'h1': `${fontExpanded} font-medium text-[48px] leading-[96px]`,
	// 'h2': `${fontExpanded} font-medium ${h2Text} ${h2LineHeight}`,
	// 'h3': `${fontExpanded} font-medium ${h3Text} leading-[48px]`,
	'h4': `${fontExpanded} font-bold text-[24px] leading-[32px]`,
	'h5': `${fontExpanded} font-bold text-[18px] leading-[32px]`,
	'h6': `${fontExpanded} font-bold text-[16px] leading-[24px]`,
	// 'subtitle1': `${fontExpanded} font-normal text-[24px] leading-[32px] tracking-[0.015em]`,
	// 'subtitle2': `${fontExpanded} font-normal text-[20px] leading-[32px] tracking-[0.015em]`,
	// 'subtitle3': `${fontExpanded} font-normal text-[18px] leading-[32px] tracking-[0.015em]`,
	// 'subtitle3-bold': `${fontExpanded} font-semibold text-[18px] leading-[32px] tracking-[0.015em]`,
	// 'body1': `${fontNormal} font-normal text-[24px] leading-[40px]`,
	// 'body2': `${fontNormal} font-normal text-[16px] leading-[24px] tracking-[0.015em]`,
	'body2-bold': `${fontNormal} font-bold text-[16px] leading-[24px] tracking-[0.015em]`,
	'body3': `${fontNormal} font-medium text-[14px] leading-[24px] tracking-[0.015em]`,
	// 'body3-bold': `${fontNormal} font-bold text-[14px] leading-[24px] tracking-[0.015em]`,
	'body4': `${fontNormal} font-medium ${VARIANT_PLAIN['body4']}`,
	'body4-bold': `${fontNormal} font-bold ${VARIANT_PLAIN['body4']}`,
	// 'body4-plain': `${fontNormal} ${VARIANT_PLAIN['body4']}`,
	'text1': `${fontExpanded} font-medium text-[14px] leading-[24px]`,
	'text1-bold': `${fontExpanded} font-bold text-[14px] leading-[24px]`,
	// 'text2': `${fontExpanded} font-medium text-[12px] leading-[24px]`,
	// 'text2-bold': `${fontExpanded} font-bold text-[12px] leading-[24px]`,
	'text3': `${fontExpanded} font-medium text-[10px] leading-[24px]`,
	// 'text3-bold': `${fontExpanded} font-bold text-[10px] leading-[24px]`,
	'overline1': `${fontExpanded} font-bold text-[14px] leading-[24px] uppercase`,
	// 'overline2': `${fontExpanded} font-bold text-[12px] leading-[24px] uppercase`,
	'overline3': `${fontExpanded} font-bold text-[10px] leading-[24px] uppercase`,
	// 'button1': `${fontNormal} font-semibold text-[16px] leading-[20px] tracking-[0.01em]`,
	'button2': `${fontNormal} font-semibold text-[12px] leading-[16px] tracking-[0.42px]`
} as const;

export type TypographyProps = TypographyText | TypographyLabel | TypographySpan;

const Typography: React.FC<TypographyProps> = ({ children, className, component, variant, ...restProps }) => {
	const cssStyle = twMerge(VARIANTS[variant], className);

	// debugUsedFonts(cssStyle, variant);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const Component: any = component ?? customHtmlTagForVariant(variant);
	return(<Component className={cssStyle} {...restProps}>
		{children}
	</Component>);
};

export default Typography;
