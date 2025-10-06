
import { useMutation, useQueryClient$ } from '@preact-signals/query';
import { twMerge } from 'tailwind-merge';

import Button from '@/components/core/Button';
import Dropdown, { DropdownContent } from '@/components/core/Dropdown';
import Toast from '@/components/core/Toast';

import { toSentenceCase } from '@/helpers/string';

import useNetworkList from './useNetworkList';
import { NetworkConfig } from '@keetanetwork/explorer-client';
import { useClientContext } from '@/providers/ClientProvider';

function NetworkSelector() {
	const { updateNetworkConfig, sdk } = useClientContext();
	const { data } = useNetworkList();
	const queryClient = useQueryClient$();
	const { mutate, isLoading } = useMutation({
		mutationFn: async function(network: NetworkConfig) {
			await updateNetworkConfig(network);
			return(network);
		},
		onError: () => {
			Toast.error('Error to change network');
		},
		onSuccess: async () => {
			Toast.success('Network changed');
			queryClient.value.resetQueries();
			window.location.reload();
		}
	});

	if (!data || data.networks.length <= 1) {
		return(null);
	}

	const { networks } = data;
	const currentNetworkAlias = sdk.value.config.networkConfig?.networkAlias ?? ''

	return(<Dropdown
		button={
			<Button
				loading={isLoading}
				variant='text'
				icon='chevron-right'
				iconSize={16}
				iconPosition='right'
				size='small'
				className={
					'[&_svg]:rotate-90 rounded-md text-lg [&_svg]:text-white py-1 px-2 bg-brand-secondary text-white'
				}
			>
				{toSentenceCase(currentNetworkAlias).toUpperCase()}
			</Button>
		}
		contentClassName='right-0'
		content={
			<DropdownContent className='w-[129px] bg-brand-secondary text-white border-brand-secondary rounded-md py-1'>
				{networks.map((item, index) => (
					<Button
						variant='text'
						className={twMerge(
							'hover:bg-primary/60 rounded-none border-0 cursor-pointer',
							item.networkAlias === currentNetworkAlias && 'bg-primary/20'
						)}
						key={index}
						onClick={() => mutate(item)}
					>
						{toSentenceCase(item.networkAlias)}
					</Button>
				))}
			</DropdownContent>
		}
	/>);
}

export default NetworkSelector;
