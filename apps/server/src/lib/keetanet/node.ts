import type { Transaction } from './transaction';
import { blockAsTransactions } from './transaction';
import { WithKeetaNet } from './base';
import { KeetaNetLib } from '@/utils/keetanet';

export type NodeStats = {
	queryTime: number;
	blockCount: number;
	transactionCount: number;
	representativeCount: number;
	time: Date;
};

type BlockPurpose = keyof typeof KeetaNetLib.lib.Block.Purpose;

type StapleBlock = {
	$opening: boolean;
	hash: string;
	signatures: string[];
	createdAt: Date;
	previousBlockHash: string;
	version: number;
	signers: string[];
	account: string;
	purpose: BlockPurpose;
	transactions: Transaction[];
};

type StapleVote = {
	id: string;
	address: string;
	validatedAt: Date;
	weight: number;
};

export type NodeVoteStaple = {
	votes: StapleVote[];
	blocks: StapleBlock[];
	originalContent: string;
};

/**
 * Node
 */
export class Node extends WithKeetaNet {
	/**
	 * Get the stats of the node
	 */
	async stats(): Promise<NodeStats> {
		const nodeStats = await this.keetaNet.network.client.getNodeStats();
		return({
			queryTime: nodeStats.ledger.momentRange * 2,
			blockCount: nodeStats.ledger.blockCount,
			transactionCount: nodeStats.ledger.transactionCount,
			representativeCount: nodeStats.ledger.representativeCount,
			time: new Date(nodeStats.ledger.moment),
		});
	}

	private signersFromBlock(signer: typeof KeetaNetLib.lib.Block.prototype.signer): string[] {
		if (Array.isArray(signer)) {
			return signer[1].flatMap(sig => this.signersFromBlock(sig));
		} else {
			return [signer.publicKeyString.toString()];
		}
	}

	/**
	 * Get the vote staple of a block
	 */
	async getVoteStaple(blockhash: string): Promise<NodeVoteStaple> {
		const voteStaple = await this.keetaNet.network.client.getVoteStaple(blockhash);
		if (!voteStaple) {
			throw(new Error('Vote staple not found'));
		}

		return({
			votes: voteStaple.votes.map(function(vote) {
				return({
					id: vote.$uid,
					address: vote.issuer.publicKeyString.toString(),
					validatedAt: vote.validityFrom,
					weight: 1
				});
			}),

			blocks: voteStaple.blocks.map((block) => {
				return({
					$opening: block.$opening,
					hash: block.hash.toString(),
					signatures: block.signatures.map(sig => sig.toString('hex')),
					createdAt: block.date,
					previousBlockHash: block.previous.toString(),
					version: block.version,
					account: block.account.publicKeyString.toString(),
					signers: this.signersFromBlock(block.signer),
					purpose: KeetaNetLib.lib.Block.Purpose[block.purpose] as BlockPurpose,

					transactions: blockAsTransactions(block)
				});
			}),

			originalContent: JSON.stringify(KeetaNetLib.lib.Utils.Conversion.toJSONSerializable(voteStaple), null, "\t")
		});
	}
}
