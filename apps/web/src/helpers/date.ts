import dayjs from "dayjs"
import type { ConfigType } from "dayjs"

// Jan 10, 2023 4:15 PM PST
export function completeDate(date?: ConfigType) {
	return dayjs(date).format("MMM D, YYYY h:mm A")
	// Add https://day.js.org/docs/en/plugin/localized-format
	// return dayjs(date).format('lll');
}

// Jan 10, 2023
export function completeDay(date?: ConfigType) {
	return dayjs(date).format("MMMM D, YYYY")
}
