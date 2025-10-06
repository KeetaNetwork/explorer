import { ExplorerSDKConfig } from '@keetanetwork/explorer-client';
import type { Signal } from '@preact/signals-react';
import { useSignal } from '@preact/signals-react';
import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import { getNetworkConfig, setNetworkConfig } from './networkConfig';
import { ExplorerClientSDK } from '@/libs/explorer-sdk';

/**
 * Context
 */
interface ClientContextProps {
	sdk: Signal<ExplorerClientSDK>;
	updateNetworkConfig: (newConfig: NonNullable<ExplorerSDKConfig['networkConfig']>) => Promise<void>;
}
const ClientContext = createContext<ClientContextProps | undefined>(undefined);

/**
 * Provider for the client-side application.
 */
type ClientProviderProps = {
	children: React.ReactNode;
};

const networkConfig = getNetworkConfig();

export function ClientProvider({ children }: ClientProviderProps) {

	const sdk = useSignal(new ExplorerClientSDK({
		baseURL: import.meta.env.VITE_API_BASE_URL,
		networkConfig: networkConfig,
	}));

	const updateNetworkConfig = async (newConfig: NonNullable<ExplorerSDKConfig['networkConfig']>) => {
		await sdk.value.updateNetworkConfig(newConfig);
		setNetworkConfig(newConfig);
	}

	return(<ClientContext.Provider value={{ sdk, updateNetworkConfig }}>
		{children}
	</ClientContext.Provider>);
}

export function useClientSDK(): ExplorerClientSDK {
	const context = useContext(ClientContext);
	if (!context) {
		throw(new Error('useClientSDK must be used within a ClientProvider'));
	}
	return(context.sdk.value);
}

export function useClientContext(): ClientContextProps {
	const context = useContext(ClientContext);
	if (!context) {
		throw(new Error('useClientContext must be used within a ClientProvider'));
	}
	return(context);
}
