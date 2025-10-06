import { useClientSDK } from "@/providers/ClientProvider";
import { useQuery$ } from "@preact-signals/query";

export function useToken(tokenPublicKey: string) {
	const sdk = useClientSDK();

	return useQuery$(() => ({
		queryKey: ['token', tokenPublicKey, 'details'],
		queryFn: () => sdk.tokens.get(tokenPublicKey),
		staleTime: 1000 * 60 * 5, // 5 minutes
	}))
}
