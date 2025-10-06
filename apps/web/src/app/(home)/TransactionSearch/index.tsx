import { useCallback } from 'react';
import * as v from 'valibot';

// import type { JSONSchemaType } from 'ajv';
import { twMerge } from 'tailwind-merge';

import Toast from '@/components/core/Toast';
import Typography from '@/components/core/Typography';

import getIsAddressOrBlockhash from '@/helpers/getIsAddressOrBlockhash';
import { useLocation } from 'preact-iso';
import { Button, FormProvider } from '@keetanetwork/web-ui';
import { useClientContext } from '@/providers/ClientProvider';

type SearchData = { search: string };

const schema = v.object({
	search: v.pipe(
		v.string("Required"),
		v.minLength(1, "Required"),
		v.check((value) => {
			// Blockhash
			if (value.length === 64) {
				return true;
			}

			// Address
			if (value.length === 67 || value.length === 69) {
				if (value.startsWith('keeta_')) {
					return true;
				}
			}

			return false;
		}, "Invalid address or blockhash")
	)
})
type SearchSchema = v.InferInput<typeof schema>;

// @ts-ignore
// const resolver = ajvResolver(schema);

export function TransactionSearch() {
	const { route } = useLocation();
	const { sdk } = useClientContext();
	const currentNetworkAlias = sdk.value.config.networkConfig?.networkAlias ?? ''

	const handleSubmit = useCallback(async function({ search }: SearchData) {
		const type = getIsAddressOrBlockhash(search);
		switch (type) {
			case null:
				Toast.error('Invalid search term');
				return;
			case 'ACCOUNT':
				return(route(`/account/${search}`));
			case 'TOKEN':
				return(route(`/token/${search}`));
			case 'BLOCKHASH':
				return(route(`/block/${search}`));

		}
	}, []);

	return(<div className='mb-4 md:mb-10 flex flex-col gap-4'>
		<Typography variant="h5" className='text-white'>
			{!currentNetworkAlias || currentNetworkAlias === 'main' ? 'Keeta Network' : `Keeta ${currentNetworkAlias.charAt(0).toUpperCase() + currentNetworkAlias.slice(1)}net`}
			&nbsp;Explorer
		</Typography>

		<FormProvider<SearchSchema> onSubmit={handleSubmit} schema={schema}>
			{({ FormField }) => (
				<FormField
					name='search'
					label='Search'
					type="text"
					placeholder='Search by Address, Txn ID, Block or Token'
					autoComplete='off'
					className='w-full sm:w-fit'
					labelProps={{ className: 'hidden' }}
					inputContainerClassName='bg-white/5 p-1 border-0'
					inputClassName={twMerge(
						'text-white outline-none bg-transparent focus:bg-white/0',
						'sm:w-[392px] p-2 w-full placeholder:text-white/50',
						'text-[14px] leading-[24px]'
					)}
					disableFocusBorderColor
					disableFocusTextColor
					errorProps={{ className: 'text-sm -mt-1' }}
					suffix={
						<Button type="submit" size='small' className='text-slate-1000 py-3 pointer-events-auto' textClassName="text-[14px] leading-[14px] font-medium">
							Search
						</Button>
					}
				/>
			)}
		</FormProvider>
	</div>);
}
