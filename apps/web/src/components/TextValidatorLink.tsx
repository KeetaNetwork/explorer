import { TextAccountLink } from "./TextAccountLink";

type TextValidatorLinkProps = {
	publicKey: string
	className?: string
	truncateChars?: number | null
};

/**
 * @TODO Do we have specific page for Validators?
 */
export function TextValidatorLink({ publicKey, truncateChars = 4, ...props }: TextValidatorLinkProps) {
	return(<TextAccountLink publicKey={publicKey} truncateChars={truncateChars} {...props} />);
}
