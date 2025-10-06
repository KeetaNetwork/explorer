import { SuperJSON } from 'superjson';
import DEPRECATED_Numeric from './numeric';
import { Numeric } from '@keetanetwork/web-ui-utils/helpers/Numeric';

const CustomSuperJSON = SuperJSON;
CustomSuperJSON.registerCustom<DEPRECATED_Numeric, string>(
  {
    isApplicable: (value: unknown): value is DEPRECATED_Numeric => value instanceof DEPRECATED_Numeric,
    serialize: (value: DEPRECATED_Numeric) => value.toJSON(),
    deserialize: (value: ConstructorParameters<typeof DEPRECATED_Numeric>[0]) => new DEPRECATED_Numeric(value),
  },
  'oldnum',
);

CustomSuperJSON.registerCustom<Numeric, string>(
  {
    isApplicable: (value: unknown): value is Numeric => value instanceof Numeric,
    serialize: (value: Numeric) => value.toString(),
    deserialize: (value: ConstructorParameters<typeof Numeric>[0]) => {
		try {
			return new Numeric(value)
		} catch (e) {
			console.error('Failed to deserialize Numeric:', e);
			return new Numeric(0);
		}
	},
  },
  'num',
);

export { CustomSuperJSON };