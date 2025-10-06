import type { PropsWithChildren, ReactElement } from 'react';
import { Suspense } from 'react';

import ErrorBoundary from '../ErrorBoundary';

export type StreamingProps = PropsWithChildren & {
	loadingFallback?: ReactElement;
	errorFallback?: ReactElement;
};

const Streaming: React.FC<StreamingProps> = ({ errorFallback, loadingFallback, children }) => {
	loadingFallback = loadingFallback ?? <div />;
	return(<ErrorBoundary fallback={errorFallback}>
		<Suspense fallback={loadingFallback}>
			{children}
		</Suspense>
	</ErrorBoundary>);
};

export default Streaming;
