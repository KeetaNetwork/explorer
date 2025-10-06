import { useLocation } from 'preact-iso';
import { twMerge } from 'tailwind-merge';

type NavLinkProps = {
	exact?: boolean;
	active?: boolean;
	to: string;
	children: React.ReactNode;
	className?: string;
	activeClassName?: string;
	onClick?: () => void;
};

function NavLink({ active, exact, to, children, activeClassName, className, onClick }: NavLinkProps) {
	const { path } = useLocation();
	const isActive = active ?? (exact ? path === to : path.startsWith(to));
	return(<a
		href={to}
		onClick={onClick}
		className={twMerge(
			'text-lg',
			className,
			isActive && twMerge('text-primary font-semibold', activeClassName)
		)}
	>
		{children}
	</a>);
}

export default NavLink;
