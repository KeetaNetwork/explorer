import {
    type ToastOptions as ToastifyOptions,
    ToastContainer as ToastifyContainer,
    toast as toastify
} from 'react-toastify';

import 'react-toastify/ReactToastify.min.css';

import Typography from '@/components/core/Typography';

import IconError from './icon-error.svg?react';
import IconInfo from './icon-info.svg?react';
import IconSuccess from './icon-success.svg?react';
import IconWarning from './icon-warning.svg?react';

type ToastProps = React.PropsWithChildren;

type ToastOptions = Pick<ToastifyOptions, 'autoClose'>;

const ToastContent: React.FC<ToastProps> = ({ children }) => (
	<Typography variant='body3' className='text-extended-text-100'>{children}</Typography>
);

export const Toast = {
	success: (text: string, options?: ToastOptions) => toastify.success(
		<ToastContent>{text}</ToastContent>,
		{
			icon: <IconSuccess />,
			...options
		}
	),

	error: (text: string, options?: ToastOptions) => toastify.error(
		<ToastContent>{text}</ToastContent>,
		{
			icon: <IconError />,
			...options
		}
	),

	warning: (text: string, options?: ToastOptions) => toastify.warning(
		<ToastContent>{text}</ToastContent>,
		{
			icon: <IconWarning />,
			...options
		}
	),

	info: (text: string, options?: ToastOptions) => toastify.info(
		<ToastContent>{text}</ToastContent>,
		{
			icon: <IconInfo />,
			...options
		}
	),

	reset: () => toastify.dismiss()
};

export const ToastContainer = () => (
	<ToastifyContainer
		hideProgressBar
		position='bottom-center'
		closeButton={false}
		className="customToastify"
		autoClose={3000}
	/>
);

export default Toast;
