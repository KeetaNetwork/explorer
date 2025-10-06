import { TextAccountLink } from './TextAccountLink';

type TextRepLinkProps = {
	publicKey: string
	className?: string
	truncateChars?: number | null
};

/**
 * @TODO Do we have specific page for Representatives?
 */
export function TextRepLink({ publicKey, truncateChars = 4, ...props }: TextRepLinkProps) {
	return(<TextAccountLink publicKey={publicKey} truncateChars={truncateChars} {...props} />);
}
