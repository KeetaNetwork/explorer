import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { PageLoader } from '@/components/layout/PageLoader';

import { useStats, type StatsState } from './useStats'; // assuming you exported State type too

const StatsContext = createContext<StatsState | undefined>(undefined);

export function StatsProvider({ children }: { children: ReactNode }) {
	// I deprecated the `useStats` hook in favor of using the context directly
	// to avoid unnecessary re-renders and to provide a more consistent API
	// for the components that consume the stats data
	const stats = useStats();

	if (!stats.previousStats) {
		return(<PageLoader />);
	}

	return(<StatsContext.Provider value={stats}>
		{children}
	</StatsContext.Provider>);
}

export function useStatsContext() {
	const context = useContext(StatsContext);
	if (!context) {
		throw(new Error('useStatsContext must be used within a StatsProvider'));
	}

	const { previousStats, ...rest } = context;
	if (!previousStats) {
		throw(new Error('useStatsContext must be used within a StatsProvider with previousStats'));
	}
	return({
		...rest,
		previousStats
	});
}
