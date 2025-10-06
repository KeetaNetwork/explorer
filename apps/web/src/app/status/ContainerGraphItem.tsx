
import type { ReactNode } from 'react';

import dayjs from 'dayjs';
import type { UTCTimestamp, IChartApi, ChartOptions, DeepPartial } from 'lightweight-charts';
import { twMerge } from 'tailwind-merge';

import Paper from '@/components/core/Paper';
import Typography from '@/components/core/Typography';

/**
 * Define the chart options
 */
export const defaultChartOptions: DeepPartial<ChartOptions> = {
	layout: {
		textColor: '#000',
		attributionLogo: false
	},
	handleScroll: {
		horzTouchDrag: false,
		vertTouchDrag: false,
		mouseWheel: false,
		pressedMouseMove: false
	},
	handleScale: {
		axisDoubleClickReset: false,
		axisPressedMouseMove: false,
		mouseWheel: false,
		pinch: false
	},
	timeScale: {
		timeVisible: true,
		secondsVisible: true,
		tickMarkFormatter: (time: number) => {
			return(dayjs(time * 1000).format('HH:mm:ss'));
		}
	},
	height: 300,
	autoSize: true
};

/**
 * Set the time scale for the chart
 */
export function setTimeScale(
	timeRange: number | null | undefined,
	chart: IChartApi,
) {
	const timeScale = chart.timeScale();
	if (timeRange === null || timeRange === undefined) {
		timeScale.fitContent();
		return;
	}

	timeScale.setVisibleRange({
		from: dayjs().subtract(timeRange, 'minute').unix() as UTCTimestamp,
		to: dayjs().unix() as UTCTimestamp
	});
}

/**
 * Container for Graph Items
 */
type ContainerGraphItemProps = {
	className?: string
	title: string
	subtitle?: string
	graph: ReactNode
	legends?: ReactNode
};
export function ContainerGraphItem(
	{ className, title, subtitle, graph, legends }: ContainerGraphItemProps
) {
	return(<Paper className={twMerge('bg-white space-y-6 md:space-y-10 p-3 md:p-5', className)}>
		<div className='space-y-1'>
			<Typography
				variant='body3'
				className='text-[16px] font-semibold md:text-[14px] md:font-normal md:text-[#B6B6B6]'
			>
				{title}
			</Typography>
			{subtitle && (
				<Typography variant='body2-bold' className='hidden md:block'>
					{subtitle}
				</Typography>
			)}
		</div>
		<div>
			{graph}
		</div>
		{legends && (
			<div className='flex flex-col xs:flex-row gap-2 md:gap-4'>
				{legends}
			</div>
		)}
	</Paper>);
}
