
import Button from '@/components/core/Button';
import Icon from '@/components/core/Icon';
import Paper from '@/components/core/Paper';
import Typography from '@/components/core/Typography';

import PageContent from '@/components/layout/PageContent';

type ErrorProps = {
	error?: Error
	reset?: () => void
};

export default function ErrorPage({ reset }: ErrorProps) {
	return(<PageContent>
		<Paper className='min-h-[365px] flex items-center justify-center flex-col gap-4'>
			<Icon type='x' size={48} className='text-error border rounded-full' />

			<div className='flex flex-col gap-3 items-center'>
				<Typography variant='h6' className='text-center'>
                    Something went wrong!
				</Typography>
				{reset && (
					<Button onClick={() => reset?.()} variant='contained' color='light'>
                        Try again
					</Button>
				)}
			</div>
		</Paper>
	</PageContent>);
}
