import { memo } from 'react';

import type { ButtonProps } from '../Button';
import Dropdown, { DropdownButton, DropdownContent } from '../Dropdown';
import type { IconProps } from '../Icon';
import Icon from '../Icon';

type MenuItem = Omit<ButtonProps, 'children'> & {
	label: ButtonProps['children'];
};

type MenuDropdownProps = {
	buttonIcon?: IconProps['type'];
	buttonIconSize?: IconProps['size'];
	items: MenuItem[];
};

const MenuDropdown: React.FC<MenuDropdownProps> = ({
	buttonIcon = 'kebab-menu',
	buttonIconSize = 16,
	items
}) => {
	return(<Dropdown
		button={
			<div>
				<Icon type={buttonIcon} size={buttonIconSize} />
			</div>
		}
		contentClassName="right-0"
		content={
			<DropdownContent className="gap-1 w-[129px]">
				{items.map(({ label, ...item }, index) => (
					<DropdownButton key={index} {...item}>
						{label}
					</DropdownButton>
				))}
			</DropdownContent>
		}
	/>);
};

export default memo(MenuDropdown);
