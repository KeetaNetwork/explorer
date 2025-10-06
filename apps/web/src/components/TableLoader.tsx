import Paper from "./core/Paper";
import { Loader } from "./Loader";

export function TableLoader() {
	return (
		<Paper
			hasPaddingHorizontal
			className='min-h-[300px] md:min-h-[365px] flex items-center justify-center flex-col gap-6'
		>
			<Loader />
		</Paper>
	)
}
