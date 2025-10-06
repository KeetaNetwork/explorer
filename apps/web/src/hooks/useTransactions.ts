import { useClientSDK } from "@/providers/ClientProvider";
import { useToast } from "@keetanetwork/web-ui";
import type { NormalizedOperation } from "@keetanetwork/web-ui/helpers/keetanet-operations";
import { useInfiniteQuery$, useQueryClient$ } from "@preact-signals/query";
import { useEffect, useRef, useState } from "preact/hooks";
import type * as Anchor from "@keetanetwork/anchor";

function scrollToAnchor() {
    const target = document.getElementById('results-container');
	if (!target) return;
    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });
}

export type Operation = ReturnType<typeof Anchor.KeetaNet.lib.Utils.Conversion.toJSONSerializable<NormalizedOperation, any>>

interface UseTransactionsProps {
	publicKey?: string
	pageSize?: number
}

export function useTransactions({ publicKey, pageSize = 10 }: UseTransactionsProps = {}) {
	//
	const sdk = useClientSDK();
	const queryClient = useQueryClient$();
	const isMounted = useRef(false);
	const [page, setPage] = useState(0);

	// Toast
	const { showToast } = useToast();

	// Query Key
	const depth = String(pageSize);
	const queryKey = ['transactions', publicKey ?? 'all', { depth }];

	const { data, isFetching, isFetchingNextPage, fetchNextPage } = useInfiniteQuery$(() => ({
		queryFn: async ({ pageParam }) => {
			const { nextCursor, stapleOperations } = await sdk.transactions({ startBlock: pageParam, depth, publicKey })
			if (pageParam === undefined) {
				isMounted.current = true;
			}
			return({ nextCursor, stapleOperations })
		},
		refetchInterval: () => {
			// Refetch each 15 seconds if on the first page
			return page > 0 ? false : 15_000;
		},
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		queryKey,
		staleTime: Infinity,
	}))

	const handleNextPage = async () => {
		if (isFetchingNextPage) return;
		if (!data || data.pages.length === 0) return;

		if (data.pages.length <= page + 1) {
			try {
				scrollToAnchor();
				await fetchNextPage({ throwOnError: true });
				setPage((prev) => prev + 1);
			} catch (error) {
				console.error("Error fetching next page:", error);
				showToast("error", "Failed to load more transactions. Please try again.");
			}
		} else {
			setPage((prev) => prev + 1);
			scrollToAnchor();
		}
	}

	const handlePreviousPage = () => {
		if (page === 0) return;
		setPage((prev) => prev - 1);
	}

	useEffect(() => {
		if (page === 0 && isMounted.current) {
			scrollToAnchor();
			queryClient.value.setQueryData<typeof data>(queryKey, (oldData) => {
				if (!oldData) return oldData;
				return { pages: oldData.pages.slice(0, 1), pageParams: oldData.pageParams.slice(0, 1) };
			});
			queryClient.value.invalidateQueries({ queryKey });
		}
	}, [page, publicKey]) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		return () => {
			// Reset page when component unmounts
			setPage(0);
			queryClient.value.resetQueries({ queryKey });
		}
	}, [publicKey]) // eslint-disable-line react-hooks/exhaustive-deps

	return ({
		data: data?.pages[page]?.stapleOperations as Operation[] ?? null,
		isFetching,
		isFetchingNextPage,
		nextPage: handleNextPage,
		previousPage: handlePreviousPage,
		currentPage: page,
		hasNextPage: data ? (!!data.pages[page].nextCursor) : false,
		hasPreviousPage: page > 0
	})
}
