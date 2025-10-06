import { TextLink } from './TextLink';

type TextBlockLinkProps = {
	blockhash: string
	className?: string
	truncateChars?: number | null
};

export function TextBlockLink({ blockhash, truncateChars = 4, ...props }: TextBlockLinkProps) {
	return(<TextLink id={blockhash} href={`/block/${blockhash}`} truncateChars={truncateChars} {...props} />);
}
