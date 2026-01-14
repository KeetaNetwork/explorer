import { Icon } from "@keetanetwork/web-ui";
import { twMerge } from "tailwind-merge";

export function IconBoolean({ value }: { value: boolean }) {
	return (
		<Icon
			type={value ? "check-circle-filled" : "close-circle-filled"}
			className={twMerge(
				"text-success size-6 -my-1",
				value ? "text-success" : "text-error"
			)}
		/>
	);
}
