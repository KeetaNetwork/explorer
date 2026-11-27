import { CustomSuperJSON } from "@/utils/json";

/**
 * Wrap a response from the explorer's API so `json()` decodes SuperJSON
 * (which the API answers with) as well as plain JSON
 */
export function withSuperJSON(response: Response): Response {
	return new Proxy(response, {
		get(target, prop, receiver) {
			if (prop === 'json') {
				return async () => {
					const parsedJson = await target.clone().json();
					if (typeof parsedJson === 'object' && parsedJson !== null && 'json' in parsedJson && typeof parsedJson.json !== 'undefined') {
						const text = await target.clone().text();
						return CustomSuperJSON.parse(text);
					}
					return parsedJson;
				};
			}
			const value = Reflect.get(target, prop, receiver);
			return typeof value === 'function' ? value.bind(target) : value;
		}
	});
}
