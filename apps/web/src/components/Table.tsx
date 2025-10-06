
import type { UseInfiniteScrollHookResult } from 'react-infinite-scroll-hook';
import { twMerge } from 'tailwind-merge';

import LoaderCircular from './core/LoaderCircular';
import withStreaming from './core/Streaming/withStreaming';
import DEPRECATED_Typography from './core/Typography';
import type { ComponentChildren } from 'preact';
import { isValidElement } from 'preact';
import { Fragment } from 'preact/compat';
import { useMemo } from 'preact/hooks';
import { Typography } from '@keetanetwork/web-ui';

export type TableColumn = {
	className?: string
	headerClassName?: string
	size?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12
	title: string
};

export type TableProps<T> = {
	className?: string
	columns: TableColumn[]
	rows: T[]
	renderRow(row: T): ComponentChildren
	isLoading?: boolean
	loadingRef?: UseInfiniteScrollHookResult[0] | false
	textEmpty?: string
	hideHeader?: boolean
};

const mapColumnsClassName = {
	first: 'p-4 pr-1.5',
	last: 'p-4 pl-1.5 text-right justify-end',
	default: 'py-4 px-1.5'
};

const headerClasses = 'py-2 md:py-4 bg-[#F5F5F5] md:bg-white';
const mapHeaderColumnsClassName = {
	first: twMerge(mapColumnsClassName['first'], headerClasses),
	last: twMerge(mapColumnsClassName['last'], headerClasses),
	default: twMerge(mapColumnsClassName['default'], headerClasses)
};

const mapSizeClassName = {
	1: 'col-span-1',
	2: 'col-span-2',
	3: 'col-span-3',
	4: 'col-span-4',
	5: 'col-span-5',
	6: 'col-span-6',
	7: 'col-span-7',
	8: 'col-span-8',
	9: 'col-span-9',
	10: 'col-span-10',
	11: 'col-span-11',
	12: 'col-span-12'
};

function calcPosition(index: number, columnsLength: number) {
	if (index === 0) {
		return('first');
	}
	if (index === columnsLength - 1) {
		return('last');
	}
	return('default');
}

function flattenNode(node: ComponentChildren): ComponentChildren[] {
	if (Array.isArray(node)) {
		return(node.flatMap(flattenNode));
	}

	if (isValidElement(node)) {
		// If it's a Fragment, recursively flatten its children
		if (node.type === Fragment) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			const children = node.props.children as ComponentChildren;
			return(flattenNode(children));
		}

		// If it's a function component, call it manually
		if (typeof node.type === 'function') {
			// @ts-expect-error
			const rendered = { ...node.type({ ...node.props }, node.type.name) };
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			rendered.name = node.type.displayName ?? node.type.name;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			rendered.key = node.key;
			return(flattenNode(rendered as ComponentChildren));
		}
	}

	// For strings, numbers, etc.
	return([node]);
}

type TableRowItemProps = { children: ComponentChildren, position?: keyof typeof mapColumnsClassName, className?: string };
export const TableRowItem = ({ children, position = 'default', className }: TableRowItemProps) => {
	return(<div
		className={twMerge(
			'flex items-center gap-1.5 whitespace-nowrap',
			mapColumnsClassName[position],
			className,
		)}
	>
		{children}
	</div>);
};
TableRowItem.displayName = 'TableRowItem';

function isTableRowItem(node: ComponentChildren): node is TableRowItemProps & ComponentChildren {
	if (Array.isArray(node)) {
		return(node.every(isTableRowItem));
	}

	if (isValidElement(node) && 'name' in node) {
		return(node.name === 'TableRowItem');
	}

	return(false);
}

/**
 * Given the grid has 12 columns, we need to calculate the size of each column based on the number of columns.
 *
 * We need to make sure that:
 * - the size of each column is a multiple of 12.
 * - the size of each column is at least 1.
 * - the size of each column is not greater than 12.
 * - the total size of all columns is not greater than 12.
 */
export function assignColumnSizes(columns: TableColumn[]): Required<TableColumn>[] {
	const totalSize = 12;
	const lockedSizes = columns
		.map(c => Number(c.size) || 0)
		.reduce((sum, size) => sum + size, 0);

	if (lockedSizes > totalSize) {
		throw(new Error('Total fixed sizes exceed the maximum grid size of 12'));
	}

	const flexibleColumns = columns.filter(c => !c.size);
	const remaining = totalSize - lockedSizes;

	if (flexibleColumns.length === 0) {
		return(columns as Required<TableColumn>[]);
	}

	const baseSize = Math.floor(remaining / flexibleColumns.length);
	const remainder = remaining % flexibleColumns.length;

	let i = 0;
	return(columns.map(col => {
		if (col.size) {return(col);}
		const size = baseSize + (i < remainder ? 1 : 0) as Required<TableColumn>['size'];
		i++;
		return({ ...col, size });
	}) as Required<TableColumn>[]);
}

function Table<T>({ className, columns, rows, renderRow, isLoading = false, loadingRef, textEmpty, hideHeader }: TableProps<T>) {
	const tableId = useMemo(() => crypto.randomUUID(), []);

	const columnsWithSize = useMemo(() => assignColumnSizes(columns), [columns]);

	const renderedColumns = useMemo(() => {
		if (hideHeader) {
			return null;
		}
		return(columnsWithSize.map(({ headerClassName, title, size }, index) => (
			<div
				className={twMerge(
					mapSizeClassName[size],
					mapHeaderColumnsClassName[calcPosition(index, columnsWithSize.length)],
					headerClassName,
				)}
				key={`table${tableId}-column-${index}`}
			>
				<Typography
					size="sm"
					weight="bold"
					className='max-md:text-[10px] text-[#808080] md:text-black uppercase md:normal-case'
				>
					{title}
				</Typography>
			</div>
		)));
	}, [tableId, columnsWithSize, hideHeader]);

	const renderedRows = (() => {
	// const renderedRows = useMemo(() => {
		return(rows.map((row, rowIndex) => {
			const rendered = renderRow(row);
			const flattened = flattenNode(rendered);
			const rowColumns = flattened.map((Column, index) => isTableRowItem(Column) ? (
				<Fragment key={`table${tableId}-row-${rowIndex}-column-${index}`}>
					{Column}
				</Fragment>
			) : (
				<TableRowItem
					key={`table${tableId}-row-${rowIndex}-column-${index}`}
					position={calcPosition(index, columnsWithSize.length)}
					className={twMerge(
						mapSizeClassName[columnsWithSize[index]?.size ?? 12],
						columnsWithSize[index]?.className
					)}
				>
					{Column}
				</TableRowItem>
			));
			return(rowColumns);
		}));
	// }, [tableId, rows, renderRow, columnsWithSize]);
	})();

	return(<div className={twMerge(
		'grid grid-cols-[repeat(12,_minmax(min-content,1fr))] overflow-x-auto lg:overflow-x-hidden [&>div]:border-b [&>div]:border-slate-100',
		className
	)}>
		{renderedColumns}
		{!isLoading && (
			renderedRows.length > 0
				? renderedRows
				: (
					<div className='col-span-12 py-20 md:py-32 flex items-center justify-center'>
						<DEPRECATED_Typography variant='h6' className='opacity-50 md:opacity-100 text-[14px] md:text-[16px]'>
							{textEmpty ?? 'There Are No Records To Display'}
						</DEPRECATED_Typography>
					</div>
				)
		)}

		{loadingRef && (
			<div ref={loadingRef} className='col-span-12 p-4 flex items-center justify-center gap-2'>
				<LoaderCircular />
			</div>
		)}
	</div>);
}

const errorFallback = <div className='flex justify-center p-8'>Something went wrong</div>;
const loadingFallback = <div className='flex justify-center p-8'>Loading...</div>;
export default withStreaming(Table, { errorFallback, loadingFallback });
