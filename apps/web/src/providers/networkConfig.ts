import { ExplorerSDKConfig } from "@keetanetwork/explorer-client";

const STORAGE_KEY = 'keeta.networkConfig';

const DEFAULT_NETWORK_CONFIG: NonNullable<ExplorerSDKConfig['networkConfig']> = {
	networkAlias: import.meta.env.VITE_APP_DEFAULT_NETWORK
};

export function getNetworkConfig(): NonNullable<ExplorerSDKConfig['networkConfig']> {
	const storedConfig = localStorage.getItem(STORAGE_KEY);
	if (storedConfig) {
		try {
			const parsed = JSON.parse(storedConfig);
			if (parsed && typeof parsed.networkAlias === 'string') {
				return parsed as NonNullable<ExplorerSDKConfig['networkConfig']>;
			} else {
				console.warn('Invalid network config in localStorage, using default');
				localStorage.removeItem(STORAGE_KEY);
			}
		} catch (error) {
			console.error('Error parsing network config from localStorage:', error);
			localStorage.removeItem(STORAGE_KEY);
		}
	}
	return DEFAULT_NETWORK_CONFIG;
}

export function setNetworkConfig(config: NonNullable<ExplorerSDKConfig['networkConfig']>) {
	if (config && typeof config.networkAlias === 'string') {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} else {
		console.error('Invalid network config provided:', config);
		throw new Error('Invalid network config');
	}
}
