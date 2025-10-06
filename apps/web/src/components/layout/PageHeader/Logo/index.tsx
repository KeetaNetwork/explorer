import { twMerge } from 'tailwind-merge';

export default function Logo() {
	return(<a
		href="/"
		// href="https://keeta.com"
		rel="noreferrer"
		className={twMerge(
			'text-xl md:border-r md:border-[#393939] md:pr-6'
		)}
	>
		<img src="/assets/logo-symbol-dark.svg" width={60} height={24} alt='Keeta' />
	</a>);
}
