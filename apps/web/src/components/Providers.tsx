import { QueryClientProvider } from '@preact-signals/query';

import { ClientProvider } from '@/providers/ClientProvider';
import queryClient from '@/utils/query-client';

import { ToastContainer } from './core/Toast';
import { LocationProvider } from 'preact-iso';
import { KeetaModalProvider, KeetaProvider, KeetaToastProvider } from '@keetanetwork/web-ui';
import type { ComponentChildren } from 'preact';

export default function Providers({ children }: { children: ComponentChildren }) {
	return(
		<KeetaProvider>
			<LocationProvider>
				<QueryClientProvider client={queryClient}>
					<KeetaToastProvider>
						<KeetaModalProvider>
							<ClientProvider>
								{children}
								<ToastContainer />
							</ClientProvider>
						</KeetaModalProvider>
					</KeetaToastProvider>
				</QueryClientProvider>
			</LocationProvider>
		</KeetaProvider>
	);
}
