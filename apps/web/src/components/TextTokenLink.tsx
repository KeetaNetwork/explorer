import * as Anchor from "@keetanetwork/anchor";
import { TextLink } from './TextLink';
import { Typography } from "@keetanetwork/web-ui";

type TextTokenLinkProps = {
	publicKey: string
	className?: string
	truncateChars?: number | null
	prefix?: string
};

export function TextTokenLink({ prefix, publicKey, truncateChars = 4, ...props }: TextTokenLinkProps) {
	const account = Anchor.KeetaNet.lib.Account.fromPublicKeyString(publicKey);
	let link;
	let _prefix;
	if (account.isToken()) {
		link = `/token/${publicKey}`;
		_prefix = prefix;
	} else if (account.isStorage()) {
		link = `/storage/${publicKey}`;
		_prefix = prefix && prefix === "Token:" ? 'Storage:' : prefix;
	} else {
		link = `/account/${publicKey}`;
		_prefix = prefix && prefix === "Token:" ? 'Account:' : prefix;
	}

	const renderLink = <TextLink id={publicKey} href={link} truncateChars={truncateChars} {...props} />;
	if (!_prefix) {
		return(renderLink);
	}
	return(<div className='flex items-center gap-1.5'>
		<Typography size="sm">{_prefix}</Typography>
		{renderLink}
	</div>);
}
