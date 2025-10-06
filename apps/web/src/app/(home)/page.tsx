import PageContent from '@/components/layout/PageContent';

import { TransactionSearch } from './TransactionSearch';
import { lazy } from 'preact-iso';
import { Suspense } from 'preact/compat';
import { TableLoader } from '@/components/TableLoader';

const Transactions = lazy(() => import('@/components/Transactions'));

export default function Home() {
	return(<PageContent>
		<TransactionSearch />

		<Suspense fallback={<TableLoader />}>
			<Transactions title="Latest Activity" />
		</Suspense>
	</PageContent>);
}
