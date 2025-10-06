import { Signal } from '@preact/signals';
import { Loader } from '../Loader';
import Paper from '../core/Paper';

import PageContent from './PageContent';

export function PageLoader({ timerCustomId }: { timerCustomId?: Signal<string> }) {
	return(<PageContent>
		<Paper
			hasPaddingHorizontal
			className='min-h-[300px] md:min-h-[365px] flex items-center justify-center flex-col gap-6'
		>
			<Loader timerCustomId={timerCustomId} />
		</Paper>
	</PageContent>);
}
