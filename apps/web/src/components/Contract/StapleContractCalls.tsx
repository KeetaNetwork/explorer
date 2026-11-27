import { useQuery } from '@preact-signals/query';
import { LoaderCircular, Typography } from '@keetanetwork/web-ui';
import { useClientSDK } from '@/providers/ClientProvider';
import { CardContainer } from '@/components/CardContainer';
import { ContractCallList } from './ContractCallList';

/**
 * The contract calls in a block's staple, with their decoded instructions
 * and the outcomes the staple's votes carry (only with contract views
 * enabled, on a local network)
 */
export function StapleContractCalls({ blockhash }: { blockhash: string }) {
	const sdk = useClientSDK();
	const contracts = sdk.contracts;
	const { data, isLoading, error } = useQuery({
		queryKey: ['contract', 'staple', blockhash, 'calls'],
		queryFn: () => contracts!.stapleCalls(blockhash),
		enabled: contracts !== null
	});

	if (!contracts) {
		return(null);
	}

	if (isLoading) {
		return(<CardContainer title="Contract calls">
			<div className='p-4 flex justify-center'><LoaderCircular /></div>
		</CardContainer>);
	}

	if (error || !data) {
		return(<CardContainer title="Contract calls">
			<div className='p-4'>
				<Typography size="sm" className='text-slate-500'>Cannot load the staple's contract calls{error instanceof Error ? `: ${error.message}` : ''}</Typography>
			</div>
		</CardContainer>);
	}

	if (data.calls.length === 0) {
		return(null);
	}

	return(<CardContainer title={`Contract calls in this staple (${data.calls.length})`}>
		{!data.hasOutcomes && (
			<div className='p-4'>
				<Typography size="sm" className='text-slate-500'>The staple's votes carry no outcomes for these calls.</Typography>
			</div>
		)}
		<ContractCallList calls={data.calls} showContract />
	</CardContainer>);
}
