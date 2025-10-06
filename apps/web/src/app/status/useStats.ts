
import { ExplorerClientSDK } from '@/libs/explorer-sdk';
import { useClientSDK } from '@/providers/ClientProvider';
import { useReducer, useEffect, useRef } from 'preact/hooks';

const INTERVAL_IN_MS = 2_500; // 2.5 seconds

type Stats = Awaited<ReturnType<typeof ExplorerClientSDK.prototype.network.stats>>['stats'];

type StatsData = Stats & {
	bps: number;
	tps: number;
	requestTime: number;
};

type Action =
	| { type: 'FETCH_SUCCESS'; payload: Stats; startRequest: Date; }
	| { type: 'ADD_STATS_DATA', payload: StatsData; }
	| { type: 'INCREMENT_ERROR_COUNT' };

export type StatsState = {
	maxBPS: number;
	maxTPS: number;
	maxTime: Date;
	errorCount: number;
	previousStats?: StatsData;
	data: StatsData[];
	lastUpdate: Date | undefined;
};

function reducer(state: StatsState, action: Action): StatsState {
	switch (action.type) {
		case 'FETCH_SUCCESS': {
			// Params
			const stats = action.payload;
			const startRequest = action.startRequest;

			// End request time
			const endRequest = new Date();

			// If current stats time is less than max time, increment error count
			if (stats.time <= state.maxTime) {
				return(reducer(state, { type: 'INCREMENT_ERROR_COUNT' }));
			}

			// Calculate request time
			const requestTime = Math.abs(endRequest.getTime() - startRequest.getTime());

			// Get previous stats
			const { previousStats } = state;
			if (!previousStats) {
				return(reducer(state, { type: 'ADD_STATS_DATA', payload: { ...stats, bps: 0, tps: 0, requestTime }}));
			}

			// Calculate time difference in seconds
			const currentTimeInMs = stats.time.getTime();
			const previousTimeInMs = previousStats.time.getTime();
			const timeDiffSeconds = (currentTimeInMs - previousTimeInMs) / 1000;

			// Calculate block difference
			const currentBlocks = stats.blockCount;
			const previousBlocks = previousStats.blockCount;
			const blockDiff = currentBlocks - previousBlocks;

			// Calculate blocks per second
			const bps = timeDiffSeconds > 0 ? Number((blockDiff / timeDiffSeconds).toFixed(2)) : 0;

			// Calculate transaction difference
			const currentTransactions = stats.transactionCount;
			const previousTransactions = previousStats.transactionCount;
			const transactionDiff = currentTransactions - previousTransactions;

			// Calculate transactions per second
			const tps = timeDiffSeconds > 0 ? Number((transactionDiff / timeDiffSeconds).toFixed(2)) : 0;

			return(reducer(state, { type: 'ADD_STATS_DATA', payload: { ...stats, bps, tps, requestTime }}));
		}

		case 'ADD_STATS_DATA': {
			// Params
			const payload = action.payload;

			// Calculate max BPS and TPS
			const maxBPS = Math.max(state.maxBPS, payload.bps);
			const maxTPS = Math.max(state.maxTPS, payload.tps);

			// Add new stats to data
			return({
				...state,
				maxTime: payload.time,
				maxBPS,
				maxTPS,
				lastUpdate: new Date(),
				previousStats: payload,
				data: [
					...state.data,
					payload
				]
			});
		}

		case 'INCREMENT_ERROR_COUNT': {
			return({
				...state,
				errorCount: state.errorCount + 1,
				lastUpdate: new Date()
			});
		}

		default: {
			return(state);
		}
	}
}

const initialState: StatsState = {
	data: [],
	errorCount: 0,
	maxTime: new Date(),
	maxBPS: 0,
	maxTPS: 0,
	lastUpdate: undefined
};


/**
 * @deprecated use useStatsContext instead
 */
export function useStats() {
	const [state, dispatch] = useReducer(reducer, initialState);
	const sdk = useClientSDK();
	// const userClient = useUserClient();

	// const statsUrl = useRef(sdk.client.network.stats.$url().toString());
	const attempts = useRef(0);

	useEffect(() => {
		const fetchData = async () => {
			// Check for pending requests, if there are more than 5, skip fetching
			// const pendingRequests = sdk.getStaleRequestsForUrl(statsUrl.current, 0);
			// if (pendingRequests.length > 5) {
			// 	const [id, req] = pendingRequests[0]
			// 	req.controller.abort('Too many pending requests');
			// 	sdk.pendingRequests.delete(id);
			// }

			try {
				// Start request time
				const startRequest = new Date();

				// Fetch stats
				attempts.current += 1;
				const { stats } = await sdk.network.stats();

				// Abort stale requests for the stats URL
				// sdk.abortStaleRequestsForUrl(statsUrl.current, INTERVAL_IN_MS);
				attempts.current = 0;

				dispatch({
					type: 'FETCH_SUCCESS',
					payload: stats,
					startRequest
				});
				return;
			} catch (error) {
				dispatch({ type: 'INCREMENT_ERROR_COUNT' });
				return;
			}
		};

		void fetchData();

		let countForAttempt = 0;
		const interval = setInterval(() => {
			console.log('Counting - attempt:', countForAttempt);
			if (countForAttempt >= attempts.current || attempts.current * INTERVAL_IN_MS > 30_000) {
				console.log('Retrying in', INTERVAL_IN_MS * attempts.current, 'ms - attempts:', attempts.current);
				countForAttempt = 0;
				return fetchData();
			}
			countForAttempt += 1;
			void fetchData();
		}, INTERVAL_IN_MS);

		return(() => {
			clearInterval(interval);
			// sdk.abortStaleRequestsForUrl(statsUrl.current, 0);
		});
	}, []);

	return(state);
}
