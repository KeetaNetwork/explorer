import Icon from '../core/Icon';

import PageContent from './PageContent';

export default function PageFooter() {
	return(<div className="bg-[#ECECEC] mt-auto">
		<PageContent className="box py-8 flex-col md:flex-row">
			<div className='flex gap-4'>
				<img src="/assets/logo-wordmark.svg" width={84} height={20} alt="Keeta" />
				<div className='px-4 border-l border-[#E0E0E0] py-3 flex gap-6'>
					<a href="https://x.com/keetanetwork" target='_blank'><Icon type='social-x' size={16} /></a>
					<a href="https://discord.gg/keeta" target='_blank'><Icon type='social-discord' size={16} /></a>
				</div>
			</div>
			<div>Copyright 2025 Keeta Inc.</div>
		</PageContent>
	</div>);
}
