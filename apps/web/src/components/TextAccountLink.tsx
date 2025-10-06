import * as Anchor from "@keetanetwork/anchor";
import { TextLink } from './TextLink';

type TextAccountLinkProps = {
	publicKey: string
	className?: string
	truncateChars?: number | null
};

export function TextAccountLink({ publicKey, truncateChars = 4, ...props }: TextAccountLinkProps) {
	const account = Anchor.KeetaNet.lib.Account.fromPublicKeyString(publicKey);
	let link;
	if (account.isToken()) {
		link = `/token/${publicKey}`;
	} else if (account.isStorage()) {
		link = `/storage/${publicKey}`;
	} else {
		link = `/account/${publicKey}`;
	}
	return(<TextLink id={publicKey} href={link} truncateChars={truncateChars} {...props} />);
}
