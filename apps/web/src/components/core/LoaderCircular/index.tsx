import { twMerge } from 'tailwind-merge';

import styles from './LoaderCircular.module.css';

type LoaderCircularProps = {
	className?: string;
	size?: number;
};

const LoaderCircular: React.FC<LoaderCircularProps> = ({ className, size = 24 }) => (
	<div className={twMerge([styles.profileMainLoader, 'loader-circular', className])}>
		<div className={twMerge(styles.loader, 'loader')} style={{ width: size, height: size }}>
			<svg
				className={styles.circularLoader}
				viewBox="25 25 50 50"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
			>
				<circle
					className={styles.loaderPath}
					cx="50"
					cy="50"
					r="20"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				/>
			</svg>
		</div>
	</div>
);

export default LoaderCircular;
