// eslint-disable-next-line
export type RemoveLast<T extends any[]> = T extends [...infer Rest, infer _] ? Rest : never;

// export type DeepRequired<T> = {
// 	[K in keyof T]: Required<T[K] extends object
// 		// eslint-disable-next-line @typescript-eslint/ban-types
// 		? T[K] extends Function
// 			? T[K]
// 			: DeepRequired<T[K]>
// 		: T[K]>;
// };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DeepRequired<T> = {
	[K in keyof T]: T[K] extends object ? Required<DeepRequired<T[K]>> : T[K];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DeepPartial<T> = { [P in keyof T]?: T[P] extends any[] ? T[P] : DeepPartial<T[P]> | undefined; };
