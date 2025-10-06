import { TextLink } from './TextLink';

type TextCertificateLinkProps = {
	hash: string
	account: string
	className?: string
	truncateChars?: number | null
};

export function TextCertificateLink({ hash, account, truncateChars = 4, ...props }: TextCertificateLinkProps) {
	return(<TextLink id={hash} href={`/account/${account}/certificate/${hash}`} truncateChars={truncateChars} {...props} />);
}
