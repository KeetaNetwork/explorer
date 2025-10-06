import { KeetaNetLib } from "@/utils/keetanet";
import type { WSContext } from "hono/ws";
import type { WebSocket } from "ws";
import type { AccountSubscription, MessageOutput } from "./types";
import type { Explorer } from "@/lib/explorer";
import { CustomSuperJSON } from "@/utils/json";

/**
 * Subscribe to account changes via WebSocket.
 */
export function websocketSubscribeMessageAccount(ws: WSContext<WebSocket>, explorer: Explorer, id?: string) {
	if (!id) {
		throw new Error('Account ID is required for WebSocket message channel');
	}

	explorer.log.debug('WebSocket', 'Subscribing to account channel', id);

	// Create an account instance from the provided ID
	const account = KeetaNetLib.lib.Account.fromPublicKeyString(id).assertAccount();
	const userClient = explorer.keetaNet.network.getUserClient(account);
	
	// Subscribe to account changes using the explorer's network client
	const subscription = userClient.on('change', data => {
		// Prepare the output message with the current head block
		const output: MessageOutput = {
			type: 'message',
			payload: {
				channel: 'account',
				data: {
					accountPublicKey: account.publicKeyString.toString(),
					currentHeadBlock: data.currentHeadBlock,
				},
			}
		}

		// Send the output message to the WebSocket client
		ws.send(CustomSuperJSON.stringify(output));
	})
	
	// Send a confirmation message that the subscription was successful
	const output: MessageOutput = {
		type: 'subscribe',
		payload: {
			channel: 'account',
			params: { id },
			status: 'success'
		},
	};
	ws.send(CustomSuperJSON.stringify(output));

	// Return the subscription to allow for cleanup later
	return {
		id,
		subscription,
		userClient,
	};
}

/**
 * Unsubscribe from account changes via WebSocket.
 */
export function websocketUnsubscribeMessageAccount(ws: WSContext<WebSocket>, explorer: Explorer, id?: string, listeners?: Set<AccountSubscription>) {
	if (!id) {
		throw new Error('Account ID is required for WebSocket message channel');
	}

	explorer.log.debug('WebSocket', 'Unsubscribing from account channel', id);
	
	// Find the subscription in the listeners set
	if (!listeners || listeners.size === 0) {
		throw new Error('No active subscriptions found for account channel');
	}

	const subscriptions = Array.from(listeners).filter(sub => sub.id === id);
	if (subscriptions.length === 0) {
		throw new Error(`No active subscription found for account ID: ${id}`);
	}

	// Unsubscribe from account changes using the explorer's network client
	for (const { userClient, subscription } of subscriptions) {
		userClient.off(subscription);
	}

	// Send a confirmation message that the unsubscription was successful
	const output: MessageOutput = {
		type: 'unsubscribe',
		payload: {
			channel: 'account',
			params: { id },
			status: 'success'
		},
	};
	ws.send(CustomSuperJSON.stringify(output));
}