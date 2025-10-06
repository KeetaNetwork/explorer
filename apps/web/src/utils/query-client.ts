import { ClientHTTPError, ClientNotFoundError, ClientUnauthorizedError } from "@keetanetwork/explorer-client";
import { QueryClient } from "@preact-signals/query";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5, // 5 minutes
			retry(failureCount: number, error: unknown): boolean {
				// if not found or not authorized, do not retry
				if (error instanceof ClientNotFoundError || error instanceof ClientUnauthorizedError) {
					return false;
				}

				// retry up to 10 times, with exponential backoff
				if (error instanceof ClientHTTPError) {
					// If the error is a ClientHTTPError, we can retry based on the status code
					// For example, we might want to retry on 500, 502, 503, and 504 errors
					// because these are typically temporary issues
					if ([500, 502, 503, 504].includes(error.status)) {
						// Limit retries to 10 attempts
						return failureCount < 10;
					}
					// For other status codes, we might not want to retry
					return false;
				}

				// For any other error, we can retry up to 15 times
				return failureCount < 15;
			},
			retryDelay(failureCount: number, error: unknown): number {
				if (error instanceof ClientHTTPError) {
					// Exponential backoff for HTTP errors, 10 retries should not exceed 1 minute
					return 1000 * 2 ** Math.min(failureCount, 9);
				}

				// For other errors, we can use a fixed delay of 1 second
				return 1000; // 1 second
			},
			retryOnMount: false,
			refetchOnWindowFocus: false,
			refetchOnMount: false,
			refetchInterval: false,
			refetchOnReconnect: true
		}
	}
});

export default queryClient;
