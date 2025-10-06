import { useRef, useEffect } from 'react';

import dayjs from 'dayjs';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { createChart, LineSeries } from 'lightweight-charts';

import Typography from '@/components/core/Typography';

import { setTimeScale, ContainerGraphItem, defaultChartOptions } from './ContainerGraphItem';
import { useStatsContext } from './context';

const Legends = () => (
	<>
		<div className='flex items-center gap-3 whitespace-nowrap'>
			<div className='rounded-full size-4 bg-[#2C2A2A]'></div>
			<Typography variant='body4'>
						Request Time
			</Typography>
		</div>

		<div className='flex items-center gap-3 whitespace-nowrap'>
			<div className='rounded-full size-4 bg-[#5078D8]'></div>
			<Typography variant='body4'>
						DB Query Time
			</Typography>
		</div>

		<div className='flex items-center gap-3 whitespace-nowrap'>
			<div className='rounded-full size-4 bg-[#CC2C1A]'></div>
			<Typography variant='body4'>
						Errors
			</Typography>
		</div>
	</>
);

let i = 0;

export function GraphStats({ timeRange } :{ timeRange?: number | null }) {
	const { previousStats, errorCount, lastUpdate } = useStatsContext();

	const chartRef = useRef<IChartApi>();
	const seriesDbRef = useRef<ISeriesApi<'Line'>>();
	const seriesQueryRef = useRef<ISeriesApi<'Line'>>();
	const seriesErrorsRef = useRef<ISeriesApi<'Line'>>();
	const chartContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const { current: chartContainer } = chartContainerRef;
		if (!chartContainer) {
			return;
		}

		const chart = createChart(chartContainer, defaultChartOptions);

		const seriesDb = chart.addSeries(LineSeries, { color: '#5078D8', lineWidth: 2 });
		const seriesQuery = chart.addSeries(LineSeries, { color: '#2C2A2A', lineWidth: 2 });
		const seriesErrors = chart.addSeries(LineSeries, { color: '#CC2C1A', lineWidth: 2 });

		seriesDbRef.current = seriesDb;
		seriesQueryRef.current = seriesQuery;
		seriesErrorsRef.current = seriesErrors;
		chartRef.current = chart;

		return(() => {
			seriesDbRef.current = undefined;
			seriesQueryRef.current = undefined;
			seriesErrorsRef.current = undefined;
			chartRef.current = undefined;
			chart.remove();
		});
	}, []);

	useEffect(() => {
		const { current: seriesDb } = seriesDbRef;
		const { current: seriesQuery } = seriesQueryRef;
		const { current: chart } = chartRef;
		if (!seriesDb || !seriesQuery || !chart) {
			return;
		}

		const time = dayjs(previousStats.time).unix() as UTCTimestamp;
		seriesDb.update({ time, value: previousStats.queryTime });
		seriesQuery.update({ time, value: previousStats.requestTime });

		if (i === 0) {
		// if (i % 2 === 0) {
		}
		i++;

	}, [seriesDbRef, seriesQueryRef, seriesErrorsRef, chartRef, previousStats]);

	useEffect(() => {
		const { current: seriesErrors } = seriesErrorsRef;
		if (!seriesErrors) {
			return;
		}

		const time = dayjs(lastUpdate).unix() as UTCTimestamp;
		seriesErrors.update({ time, value: errorCount });
	}, [errorCount, lastUpdate]);

	useEffect(() => {
		const { current: chart } = chartRef;
		if (!chart) {
			return;
		}

		setTimeScale(timeRange, chart);
	}, [timeRange, previousStats]);

	return(<ContainerGraphItem
		title='Stats Response Time'
		graph={<div ref={chartContainerRef} />}
		className='md:col-span-2'
		legends={<Legends />}
	/>);
}
