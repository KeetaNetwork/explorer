import { Typography } from "@keetanetwork/web-ui";
import { TextAccountLink } from "./TextAccountLink";
import type { NonNullableProps } from "@/utils/types";
import { CardContainer, type CardContainerProps } from "./CardContainer";
import { twMerge } from "tailwind-merge";
import { TextBlockLink } from "./TextBlockLink";
import { completeDate, completeDay } from "@/helpers/date";
import type { VNode } from "preact";

type ContentItemType = "text" | "account" | "block" | "datetime" | "date" | "jsx";

interface ContentItemBase {
	type?: ContentItemType;
	label: string;
	value: unknown;
}

interface ContentItemText extends ContentItemBase {
	type?: Extract<ContentItemType, "text">;
	value: string | number | boolean | null | undefined;
}

interface ContentItemAccount extends ContentItemBase {
	type: Extract<ContentItemType, "account">;
	value: string | null;
}

interface ContentItemBlock extends ContentItemBase {
	type: Extract<ContentItemType, "block">;
	value: string | null;
}

interface ContentItemDatetime extends ContentItemBase {
	type: Extract<ContentItemType, "datetime" | "date">;
	value: Date;
}

interface ContentItemJSX extends ContentItemBase {
	type: Extract<ContentItemType, "jsx">;
	value: VNode | undefined;
}

export type ContentItem = ContentItemText | ContentItemAccount | ContentItemBlock | ContentItemDatetime | ContentItemJSX;

interface ContentCardProps extends CardContainerProps {
	content: ContentItem[]
}

/**
 * Utility function to check if a value is valid
 */
function isValidValue<T extends ContentItem['value']>(value: T): value is NonNullable<T> {
	return value !== undefined && value !== null && value !== '';
}

/**
 * Component to render the value of a content item
 */
function ContentCardValue(props: NonNullableProps<ContentItem>) {
	if (props.type === "account") {
		return <TextAccountLink publicKey={props.value} truncateChars={9} />
	} else if (props.type === "block") {
		return <TextBlockLink blockhash={props.value} truncateChars={9} />
	} else if (props.type === "datetime") {
		return <Typography size="sm">{completeDate(props.value)}</Typography>;
	} else if (props.type === "date") {
		return <Typography size="sm">{completeDay(props.value)}</Typography>;
	} else if (props.type === "jsx") {
		return <>{props.value}</>;
	}
	return <Typography size="sm">{props.value}</Typography>;
}

/**
 * Component to display a card with title and content items
 */
export function ContentCard({ content, ...containerProps }: ContentCardProps) {
	// Filter out items with invalid values
	const filteredContent = content.filter(item => isValidValue(item.value));

	// If no valid content, return null
	if (filteredContent.length === 0) {
		return null;
	}

	return (
		<CardContainer {...containerProps} contentClassName={twMerge("overflow-x-auto", containerProps.contentClassName)}>
			{filteredContent.map((item, index) => (
				<div className="box p-4 gap-2 [&>*]:whitespace-nowrap" key={index}>
					<Typography size="sm" className="mr-auto">{item.label}</Typography>
					<ContentCardValue {...item as NonNullableProps<ContentItem>} />
				</div>
			))}
		</CardContainer>
	)
}
