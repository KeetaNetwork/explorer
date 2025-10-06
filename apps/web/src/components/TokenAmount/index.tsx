import { useToken } from '@/hooks/useToken';
import LoaderCircular from '../core/LoaderCircular';
import type { ExplorerClientSDK } from '@/libs/explorer-sdk';
import type { Numeric } from '@keetanetwork/web-ui/helpers/Numeric';
import { Typography } from '@keetanetwork/web-ui';

type Props = {
	className?: string,
	amount: Numeric,
	tokenPublicKey: string,
	tokenInfo?: Awaited<ReturnType<ExplorerClientSDK['tokens']['get']>>['token']
}
function TokenAmount({ amount, tokenPublicKey, tokenInfo, className }: Props) {
	// eslint-disable-next-line react-hooks/rules-of-hooks
	const { data } = tokenInfo ? { data: { token: tokenInfo } } : useToken(tokenPublicKey);
	if (!data) {
		return <LoaderCircular size={16} />
	}

	const { token } = data;

	// return(<div data-tooltip={amount.toDecimalString(token.decimalPlaces, true, true)}>
	return(<div>
		<Typography size="sm" className={className}>
			{amount.toDecimalString(token.decimalPlaces, true, true)} {token.currencyCode}
		</Typography>
	</div>);
}

export default TokenAmount;
