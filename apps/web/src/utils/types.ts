export type PartialRecord<K extends keyof any, T> = {
	// eslint-disable-next-line
  [P in K]?: T;
};

export type NonNullableProps<T> = {
	[K in keyof T]: NonNullable<T[K]>
}
