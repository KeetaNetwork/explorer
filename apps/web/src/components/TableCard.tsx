import type { ComponentChildren } from "preact";
import type { CardContainerProps } from "./CardContainer";
import { CardContainer } from "./CardContainer";
import type { TableColumn } from "./Table";
import Table from "./Table";

interface TableCardProps<T = any> extends CardContainerProps {
	columns: TableColumn[]
	rows: T[];
	renderRow(row: T): ComponentChildren
	hideHeader?: boolean
}

/**
 * Component to display a table with title and content items
 */
export function TableCard<T = any>({ columns, rows, renderRow, hideHeader, ...containerProps }: TableCardProps<T>) {
	// If no rows, return null
	if (rows.length === 0) {
		return null;
	}

	return (
		<CardContainer {...containerProps}>
			<Table columns={columns} rows={rows} renderRow={renderRow} hideHeader={hideHeader} />
		</CardContainer>
	)
}
