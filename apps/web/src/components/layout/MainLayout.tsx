import { Router, Route, lazy, useLocation } from 'preact-iso';

import PageFooter from './PageFooter';
import PageHeader from './PageHeader';
import { PageLoader } from './PageLoader';
import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { useClientContext, useClientSDK } from '@/providers/ClientProvider';
import { getNetworkConfigFromQuery } from '@keetanetwork/explorer-client';

const timer = signal(Date.now().toString());

function onLoadStart() {
	document.getElementById('page-loading')?.classList.remove('hidden');
	document.getElementById('page-content')?.classList.add('hidden');
	timer.value = Date.now().toString();
}

function onLoadEnd() {
	document.getElementById('page-loading')?.classList.add('hidden');
	document.getElementById('page-content')?.classList.remove('hidden');
}

function MainLayout() {
	return(
		<>
			<CheckURLNetwork />

			<div className='flex min-h-full flex-col'>
				<PageHeader />

				<section id="page-loading" className='relative z-10 my-4 md:my-10'>
					<PageLoader timerCustomId={timer} />
				</section>

				<main id="page-content" className='relative z-10 py-4 md:py-10'>
					<Router onLoadStart={onLoadStart} onLoadEnd={onLoadEnd}>
						<Route path="/" component={lazy(() => import("@/app/(home)/page"))} />
						<Route path="/status" component={lazy(() => import("@/app/status/page"))} />
						<Route path="/account/:accountPublicKey" component={lazy(() => import("@/app/account/[accountPublicKey]/page"))} />
						<Route path="/account/:accountPublicKey/certificate/:certificateHash" component={lazy(() => import("@/app/account/[accountPublicKey]/certificate/[certificateHash]/page"))} />
						<Route path="/token/:tokenPublicKey" component={lazy(() => import("@/app/token/[tokenPublicKey]/page"))} />
						<Route path="/block/:blockhash" component={lazy(() => import("@/app/block/[blockhash]/page"))} />
						<Route path="/staple/:blockhash" component={lazy(() => import("@/app/staple/[blockhash]/page"))} />
						<Route path="/storage/:accountPublicKey" component={lazy(() => import("@/app/storage/[accountPublicKey]/page"))} />
						<Route default component={lazy(() => import("@/app/not-found"))} />
					</Router>
				</main>

				<PageFooter />
			</div>
		</>
	);
}

function shallowEqual(obj1: object, obj2: object): boolean {
	const entries1 = Object.entries(obj1).filter(([, v]) => v !== undefined);
	const entries2 = Object.entries(obj2).filter(([, v]) => v !== undefined);

	const keys1 = entries1.map(([k]) => k);
	const keys2 = entries2.map(([k]) => k);

	if (keys1.length !== keys2.length) return false;

	// @ts-ignore
	return entries1.every(([key, val]) => obj2[key] === val);
}

function CheckURLNetwork() {
	const { query } = useLocation();
	const sdk = useClientSDK();
	const { updateNetworkConfig } = useClientContext();

	useEffect(() => {
		const queryNetworkConfig = getNetworkConfigFromQuery(query);

		// Update the SDK's network config if it differs from the query parameters
		if (queryNetworkConfig && !shallowEqual(queryNetworkConfig, sdk.config.networkConfig)) {
			updateNetworkConfig(queryNetworkConfig).then(() => {
				window.location.reload();
			}).catch((error) => {
				console.error('Error updating network config:', error);
			});
		}
	}, [query]);

	return false;
}

export default MainLayout;
