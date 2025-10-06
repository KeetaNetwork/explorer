import type { Network } from '@/lib/network';
import { Accounts } from './account';
import { Node } from './node';

/**
 * KeetaNet network
 */
export class KeetaNet {
	network: Network;

	readonly accounts: Accounts;
	readonly node: Node;

	constructor(network: Network) {
		this.network = network;

		this.accounts = new Accounts(this);
		this.node = new Node(this);
	}

	copy(network?: Network): KeetaNet {
		return new KeetaNet(network ?? this.network);
	}

	async destroy() {
		await this.network.destroy();

		await Promise.allSettled([
			this.accounts.destroy(),
			this.node.destroy(),
		])
	}
}
