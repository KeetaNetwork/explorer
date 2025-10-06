import { useQuery } from '@preact-signals/query';

import { useClientSDK } from '@/providers/ClientProvider';

export default function useNetworkList() {
	const sdk = useClientSDK();
	return(useQuery({
		queryKey: ['network.list'],
		queryFn: () => sdk.network.list()
	}));
}
