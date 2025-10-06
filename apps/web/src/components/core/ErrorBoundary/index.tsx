import type { PropsWithChildren, ReactElement } from 'react';

import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';

type ErrorBoundaryProps = PropsWithChildren & {
	fallback?: ReactElement;
};

const ErrorBoundary: React.FC<ErrorBoundaryProps> = ({ fallback, children }) => {
	fallback = fallback ?? <div />;
	return(<ReactErrorBoundary onError={(error) => console.log('[ERROR]', error)} fallback={fallback}>
		{children}
	</ReactErrorBoundary>);
};

export default ErrorBoundary;
