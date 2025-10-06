import Icon from '@/components/core/Icon';
import Paper from '@/components/core/Paper';
import Typography from '@/components/core/Typography';

import PageContent from '@/components/layout/PageContent';

export default function NotFoundPage() {
	return(<PageContent>
		<Paper className='min-h-[365px] flex items-center justify-center flex-col gap-4'>
			<Icon type='question-mark' size={48} />

			<div className='space-y-1'>
				<Typography variant='h6' className='text-center'>
					Page Not Found
				</Typography>
				<Typography variant='body4' className='text-center text-[#8F8D8D]'>
					The page you’re looking for doesn’t exist or has been moved.
				</Typography>
			</div>
		</Paper>
	</PageContent>);
}
