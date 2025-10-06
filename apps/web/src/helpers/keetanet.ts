import { KeetaNet } from "@keetanetwork/anchor"

const inverted = Object.entries(KeetaNet.lib.Block.AdjustMethod).reduce(
	(acc, [key, value]) => {
		if (typeof value === "number") {
			acc[value] = key as keyof typeof KeetaNet.lib.Block.AdjustMethod
		}
		return acc
	},
	{} as Record<number, keyof typeof KeetaNet.lib.Block.AdjustMethod>,
)
export function getAdjustMethodName(method: number): keyof typeof KeetaNet.lib.Block.AdjustMethod {
	if (method in inverted) {
		return inverted[method]
	}
	throw new Error(`Unknown adjust method: ${method}`)
}
