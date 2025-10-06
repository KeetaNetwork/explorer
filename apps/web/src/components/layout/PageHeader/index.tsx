import { twMerge } from 'tailwind-merge';

import Icon from '@/components/core/Icon';

import NavLink from '@/components/NavLink';
import PageContent from '@/components/layout/PageContent';

import Logo from './Logo';
import { lazy } from 'preact-iso';
import { useRef, useCallback } from 'preact/hooks';
import { Suspense } from 'preact/compat';

const NetworkSelector = lazy(() => import('./NetworkSelector'));

function PageHeader() {

	const checkboxRef = useRef<HTMLInputElement>(null);

	const closeMenu = useCallback(function(ref: React.RefObject<HTMLInputElement>) {
		return(() => {
			if (ref.current) {
				ref.current.checked = false;
			}
		});
	}, []);

	return(<>
		<div className='bg-background-header h-[328px] md:h-[340px] absolute w-full inset-0 z-0 min-w-[340px]' />
		<div className="relative group flex flex-col items-center">
			<PageContent>
				<div className="box border-b border-white/10 relative">
					<div className="flex flex-col md:flex-row md:items-center w-full py-6 md:p-0">
						<div className="box">
							<div className='box gap-4'>
								<Logo />
								<Suspense fallback={<div/>}>
									<NetworkSelector />
								</Suspense>
							</div>

							{/* Mobile Menu Button */}
							<label
								className="md:hidden text-white cursor-pointer"
								aria-label="Toggle menu"
							>
								<Icon type='menu' size={24} />

								<input type="checkbox" className="hidden" ref={checkboxRef} />
							</label>
						</div>
					</div>

					<div
						className={twMerge(
							'absolute md:relative bg-brand-secondary md:bg-background-header rounded-md',
							'z-50 border border-white/5 md:border-0',

							'hidden md:block',
							'group-has-[:checked]:w-full group-has-[:checked]:overflow-hidden',
							'group-has-[:checked]:block group-has-[:checked]:top-4 group-has-[:checked]:left-0',
							'group-has-[:checked]:shadow-lg group-has-[:checked]:shadow-black/80',
						)}
					>
						<div className='flex justify-between items-center p-4 md:hidden'>
							<Logo />

							{/* Mobile Menu Button */}
							<button
								onClick={closeMenu(checkboxRef)}
								className="text-white"
								aria-label="Toggle menu"
							>
								<Icon type='x' size={24} />
							</button>
						</div>
						<ul className={twMerge(
							'box flex-col md:flex-row md:gap-10 md:pl-7 text-white w-full',
							'divide-y md:divide-y-0 divide-[#5D5C5C]'
						)}>
							<li className='w-full md:w-fit'>
								<NavLink
									to="/"
									onClick={closeMenu(checkboxRef)}
									exact
									activeClassName={twMerge(
										'text-white border-brand-primary font-normal bg-white/10 md:bg-background-header'
									)}
									className={twMerge(
										'block px-4 md:px-0 py-3 md:py-7 md:border-b-2 border-background-header text-[16px]',
									)}
								>
								Explorer
								</NavLink>
							</li>
							<li className='w-full md:w-fit'>
								<NavLink
									to="/status"
									onClick={closeMenu(checkboxRef)}
									activeClassName={twMerge(
										'text-white border-brand-primary font-normal bg-white/10 md:bg-background-header'
									)}
									className={twMerge(
										'block px-4 md:px-0 py-3 md:py-7 md:border-b-2 border-background-header text-[16px]',
									)}
								>
								Status
								</NavLink>
							</li>
						</ul>
					</div>
				</div>
			</PageContent>
		</div>
	</>);
}

export default PageHeader;
