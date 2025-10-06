import type { KeetaNet } from ".";

/**
 * Extend WithKeetaNet
 */
export class WithKeetaNet {

	constructor(public readonly keetaNet: KeetaNet) {}

	async destroy() {
		await this.keetaNet.network.destroy();
	}
}
