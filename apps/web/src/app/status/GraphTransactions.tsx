import { useRef, useEffect } from 'react';

import dayjs from 'dayjs';
import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';
import { createChart, LineSeries } from 'lightweight-charts';

import { setTimeScale, ContainerGraphItem, defaultChartOptions } from './ContainerGraphItem';
import { useStatsContext } from './context';

export function GraphTransactions({ timeRange } :{ timeRange?: number | null }) {
	const { previousStats, maxTPS } = useStatsContext();

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
			color: '#2C2A2A', lineWidth: 2
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
			value: previousStats.tps
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
		title='Transactions'
		subtitle={`${previousStats.tps.toLocaleString()} tps - Max ${maxTPS.toLocaleString()} tps`}
		graph={<div ref={chartContainerRef} />}
	/>);
}
