
import Typography from '@/components/core/Typography';

import { useStatsContext } from './context';

function StatusCard({ title, value, valueSup }: { title: string, value: string, valueSup?: string }) {
	return(<div className='bg-black rounded-lg w-full'>
		<div className='bg-white/5 rounded-lg px-5 py-3 md:py-5'>
			<Typography variant='body3' className='text-[#ECECEC]'>
				{title}
			</Typography>
			<Typography variant='h4' className='text-white'>
				{value}
				{valueSup && <sup>{valueSup}</sup>}
			</Typography>
		</div>
	</div>);
}

export function ContainerTotals() {
	const { previousStats } = useStatsContext();
	return(<div className='grid grid-rows-3 md:grid-rows-1 md:grid-cols-3 gap-5 lg:gap-8'>
		<StatusCard title='Blocks' value={previousStats.blockCount.toLocaleString()} />
		<StatusCard title='Transactions' value={previousStats.transactionCount.toLocaleString()} />
		<StatusCard title='Response time' value={previousStats.requestTime.toLocaleString()} valueSup='ms' />
	</div>);
}
