
import { GraphBlocks } from './GraphBlocks';
import { GraphStats } from './GraphStats';
import { GraphTransactions } from './GraphTransactions';

export function ContainerGraphs({ timeRange }: { timeRange?: number | null }) {
	return(<div className='grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-8'>
		<GraphBlocks timeRange={timeRange} />
		<GraphTransactions timeRange={timeRange} />
		<GraphStats timeRange={timeRange} />
	</div>);
}
