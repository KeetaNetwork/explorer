import { LoaderCircular, IconButton } from "@keetanetwork/web-ui";
import { twMerge } from "tailwind-merge";
import Paper, { PaperTitle } from "./core/Paper";
import { Loader } from "./Loader";
import type { ComponentChildren } from "preact";

interface PaginatedCardProps<T> {
	title: string
	isFetching: boolean
	isFetchingNextPage: boolean
	nextPage: () => void
	previousPage: () => void
	hasNextPage: boolean
	hasPreviousPage: boolean
	data: T[] | null
	children: (rows: T[]) => ComponentChildren
}

export function PaginatedCard<T extends object>({ hasNextPage, hasPreviousPage, isFetching, isFetchingNextPage, nextPage, previousPage, title, data, children }: PaginatedCardProps<T>) {
	if (!data) {
		return(
			<Paper
				hasPaddingHorizontal
				className='min-h-[300px] md:min-h-[365px] flex items-center justify-center flex-col gap-6'
			>
				<Loader />
			</Paper>
		);
	}

	return (<Paper>
		<div className='box border-b border-slate-100' id="results-container">
			<PaperTitle hasPadding className='text-nowrap'>
				{title}
			</PaperTitle>

			<div className="pr-4">
				{isFetching && !isFetchingNextPage && (
					<LoaderCircular />
				)}
			</div>
		</div>

		<div className="relative">
			{children(data)}

			<div className={twMerge(
				"absolute inset-0 flex items-center justify-center gap-6 z-10 border-b border-b-slate-100 bg-white transition-all",
				isFetchingNextPage ? "opacity-100" : "opacity-0 pointer-events-none"
			)}>
				<LoaderCircular className="size-8 opacity-60" />
			</div>
		</div>

		<div className="flex justify-between items-center p-4">
			<div />

			<div className="flex gap-2">
				<IconButton
					onClick={previousPage}
					disabled={!hasPreviousPage || isFetching}
					type="chevron-left"
					size="small"
					variant="tertiary"
				/>
				<IconButton
					disabled={!hasNextPage || isFetching}
					onClick={nextPage}
					type="chevron-right"
					size="small"
					variant="tertiary"
				/>
			</div>
		</div>
	</Paper>);
}
