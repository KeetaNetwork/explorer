import { useLocation } from "preact-iso";
import { useEffect } from "preact/hooks";

/**
 * This page is a redirect to the block page.
 *
 * @deprecated This page is deprecated and will be removed in the future.
 */
export default function StaplePage({ params: { blockhash }}: { params: { blockhash: string }}) {
	const { route } = useLocation();
	useEffect(() => {
		route(`/block/${blockhash}`, true);
	}, [])

	return false
}
