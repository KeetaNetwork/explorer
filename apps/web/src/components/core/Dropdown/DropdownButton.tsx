import type { ButtonProps } from '../Button';
import Button from '../Button';

const DropdownButton: React.FC<ButtonProps> = (props) => (
	<Button variant='text' typographyVariant='body4' {...props} />
);

export default DropdownButton;
