import Toast from '@/components/core/Toast';

import { isArray } from './assertions';

export async function copy(text: string | string[]) {
	const textToCopy = isArray(text) ? text.join(' ') : text;
	await navigator.clipboard.writeText(textToCopy);
	Toast.success('Copied to clipboard', { autoClose: 1500 });
}
