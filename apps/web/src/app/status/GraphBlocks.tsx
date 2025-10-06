import { useEffect, useRef } from 'react';

import dayjs from 'dayjs';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { createChart, LineSeries } from 'lightweight-charts';

import { setTimeScale, ContainerGraphItem, defaultChartOptions } from './ContainerGraphItem';
import { useStatsContext } from './context';

export function GraphBlocks({ timeRange } :{ timeRange?: number | null }) {
	const { previousStats, maxBPS } = useStatsContext();

	const chartRef = useRef<IChartApi>();
	const seriesRef = useRef<ISeriesApi<'Line'>>();
	const chartContainerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const { current: chartContainer } = chartContainerRef;
		if (!chartContainer) {
			return;
		}

		const chart = createChart(chartContainer, defaultChartOptions);

		const newSeries = chart.addSeries(LineSeries, {
			color: '#FF886D', lineWidth: 2
		});

		seriesRef.current = newSeries;
		chartRef.current = chart;

		return(() => {
			seriesRef.current = undefined;
			chartRef.current = undefined;
			chart.remove();
		});
	}, []);

	useEffect(() => {
		const { current: series } = seriesRef;
		const { current: chart } = chartRef;
		if (!series || !chart) {
			return;
		}

		series.update({
			time: dayjs(previousStats.time).unix() as UTCTimestamp,
			value: previousStats.bps
		});

	}, [seriesRef, chartRef, previousStats]);

	useEffect(() => {
		const { current: chart } = chartRef;
		if (!chart) {
			return;
		}

		setTimeScale(timeRange, chart);
	}, [timeRange, previousStats]);

	return(<ContainerGraphItem
		title='Blocks'
		subtitle={`${previousStats.bps.toLocaleString()} bps - Max ${maxBPS.toLocaleString()} bps`}
		graph={<div ref={chartContainerRef} />}
	/>);
}
