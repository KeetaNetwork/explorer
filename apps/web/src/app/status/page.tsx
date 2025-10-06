
import { useRef, useState } from 'react';

import { twMerge } from 'tailwind-merge';

import Button from '@/components/core/Button';
import Icon from '@/components/core/Icon';
import Typography from '@/components/core/Typography';

import PageContent from '@/components/layout/PageContent';

import { ContainerGraphs } from './ContainerGraphs';
import { ContainerTotals } from './ContainerTotals';
import { StatsProvider } from './context';

type RangeOptions = 1 | 5 | 10 | 30 | 60 | null;

const options: { value: RangeOptions; label: string }[] = [
	{ value: 1, label: '1 minute' },
	{ value: 5, label: '5 minutes' },
	{ value: 10, label: '10 minutes' },
	{ value: 30, label: '30 minutes' },
	{ value: 60, label: '60 minutes' },
	{ value: null, label: 'All' }
];

function StatusPage() {
	const [timeRange, setTimeRange] = useState<RangeOptions>(1);
	const checkboxRef = useRef<HTMLInputElement>(null);

	return(<StatsProvider>
		<PageContent>
			<div className='flex flex-col gap-4 mb-6 md:mb-10'>
				<div className='box'>
					<div className='flex gap-2 text-white items-center opacity-50 md:opacity-100'>
						<Icon type='stats' size={16} />

						<Typography
							className="capitalize md:uppercase"
							variant="overline1"
						>
						Network Status
						</Typography>
					</div>

					<div className='group relative min-w-32 shrink-0'>
						<label className={
							'text-white bg-white/5 rounded-md px-3 py-1 box gap-2 cursor-pointer select-none w-full'
						}>
							<Typography variant='body4'>
								{options.find((item) => item.value === timeRange)?.label ?? 'All'}
							</Typography>
							<Icon type='filter' size={16} />
							<input type='checkbox' className='hidden' ref={checkboxRef} />
						</label>
						<div className={
							'hidden text-white group-has-[:checked]:block absolute w-full bg-brand-secondary rounded-md py-1'
						}>
							{options.map((item, index) => (
								<Button
									variant='text'
									className={twMerge(
										'hover:bg-primary/60 rounded-none border-0 w-full',
										item.value === timeRange && 'bg-primary/20'
									)}
									key={index}
									onClick={() => {
										setTimeRange(item.value);
										if (checkboxRef.current) {
											checkboxRef.current.checked = false;
										}
									}}
								>
									{item.label}
								</Button>
							))}
						</div>
					</div>
				</div>

				<ContainerTotals />
			</div>

			<ContainerGraphs timeRange={timeRange} />
		</PageContent>
	</StatsProvider>);
}

export default StatusPage;
