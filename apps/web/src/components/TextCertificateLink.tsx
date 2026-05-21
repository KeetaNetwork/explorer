import { NormalizedOperationMANAGE_CERTIFICATE } from '@keetanetwork/web-ui/helpers/keetanet-operations';
import { TextLink } from './TextLink';
import { KeetaNet } from '@keetanetwork/anchor';
import type { ToJSONSerializable } from "@keetanetwork/anchor/lib/utils/json";

type TextCertificateLinkProps = {
	hash: string | NormalizedOperationMANAGE_CERTIFICATE['operation']['certificateOrHash'] | ToJSONSerializable<NormalizedOperationMANAGE_CERTIFICATE['operation']['certificateOrHash']>;
	account: string
	className?: string
	truncateChars?: number | null
};

export function TextCertificateLink({ hash, account, truncateChars = 4, ...props }: TextCertificateLinkProps) {
	let normalizedHash;
	if (typeof hash === 'string') {
		normalizedHash = hash;
	} else if (KeetaNet.lib.Utils.Certificate.CertificateHash.isInstance(hash)) {
		normalizedHash = hash.toString();
	} else if (KeetaNet.lib.Utils.Certificate.Certificate.isCertificate(hash)) {
		normalizedHash = hash.hash.toString();
	} else {
		throw(new Error('Invalid certificate hash'));
	}

	return(<TextLink id={normalizedHash} href={`/account/${account}/certificate/${normalizedHash}`} truncateChars={truncateChars} {...props} />);
}
