type ValueType = 'ACCOUNT' | 'BLOCKHASH' | 'TOKEN' | null;

const BLOCK_LENGTH = 64 as const;
const PREFIX = 'keeta_' as const;

const tokenPrefix = ['am', 'an', 'ao', 'ap'];

const getIsAddressOrBlockhash = (value: string): ValueType => {
	if (value.length === BLOCK_LENGTH) {
		return('BLOCKHASH');
	}

	/**
	 * Check if starts with keeta_
	 * If it's keeta_[am, an, ao, ap], then it's a token.
	 * Otherwise, it's an account
	 */
	if (value.startsWith(PREFIX)) {
		const token = tokenPrefix.some((prefix) => value.startsWith(`${PREFIX}${prefix}`));
		if (token) {
			return('TOKEN');
		}
		return('ACCOUNT');
	}

	return(null);
};

export default getIsAddressOrBlockhash;
