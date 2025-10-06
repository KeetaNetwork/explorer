
import { copy } from '@/utils/copy';

import type { IconProps } from './core/Icon';
import Icon from './core/Icon';

export function CopyButton(
	{ text, iconSize = 16 }: { text: Parameters<typeof copy>[0], iconSize?: IconProps['size'] }
) {
	return(<a onClick={() => copy(text)} className='cursor-pointer shrink-0 inline-block' title="Copy to clipboard">
		<Icon type='copy' size={iconSize} className='text-[#B6B6B6]' />
	</a>);
}
