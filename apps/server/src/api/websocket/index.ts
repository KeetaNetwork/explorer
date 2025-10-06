import { cloneExplorerInstanceFromRequest, type WorkerEnv } from "@/lib/explorer/worker";
import { Hono, type Context } from "hono";
import type { WSEvents } from "hono/ws";
import { WebSocket } from "ws";
import type { AccountSubscription, MessageOutput } from "./types";
import { isMessageInput } from "./helpers";
import { websocketSubscribeMessageAccount, websocketUnsubscribeMessageAccount } from "./message-account";
import { websocketSubscribeMessageToken, websocketUnsubscribeMessageToken } from "./message-token";
import { CustomSuperJSON } from "@/utils/json";

/**
 * WebSocket handler for the Explorer
 */
export function websocketEndpoint(c: Context<WorkerEnv>): WSEvents<WebSocket> {
	const explorer = cloneExplorerInstanceFromRequest(c.get('explorer'), c);
	explorer.log.debug('WebSocket', `New connection / URL: ${c.req.url} / Network Alias: ${explorer.keetaNet.network.networkAlias}`);

	const subscribedChannels = {
		account: new Set<AccountSubscription>(),
		token: new Set<AccountSubscription>(),
	};

	return {
		/**
		 * Handle the WebSocket connection open event.
		 */
		onOpen: async (evt, ws) => {
			explorer.log.debug('WebSocket', `Connection opened for network "${explorer.keetaNet.network.networkAlias}"`);
		},

		/*
		 * Handle the WebSocket connection close event.
		 * This is called when the client closes the connection.
		 */
		onClose: (evt, ws) => {
			explorer.log.debug('WebSocket', 'Connection closed', evt.code, evt.reason);

			// Unsubscribe from all account channels.
			subscribedChannels.account.forEach((subscription) => {
				websocketUnsubscribeMessageAccount(ws, explorer, subscription.id, subscribedChannels.account);
			});

			// Unsubscribe from all token channels.
			subscribedChannels.token.forEach((subscription) => {
				websocketUnsubscribeMessageToken(ws, explorer, subscription.id, subscribedChannels.token);
			});
		},

		/**
		 * Handle incoming messages from the Client.
		 */
		onMessage: async (evt, ws) => {
			// Parse the incoming message and validate its structure.
			const parsed = CustomSuperJSON.parse(evt.data);
			if (!isMessageInput(parsed)) {
				explorer.log.error('WebSocket', 'Invalid message format', parsed);
				return;
			}

			// Handle the message based on its type.
			switch (parsed.type) {
				/**
				 * Subscribe to a channel.
				 */
				case 'subscribe': {
					explorer.log.debug('WebSocket', 'Subscribe message received', parsed.payload);
					const { channel } = parsed.payload;
					try {
						switch (channel) {
							case 'account': {
								const subscribed = websocketSubscribeMessageAccount(ws, explorer, parsed.payload.params?.id);
								subscribedChannels['account'].add(subscribed);
								return;
							}

							case 'token': {
								const subscribed = websocketSubscribeMessageToken(ws, explorer, parsed.payload.params?.id);
								subscribedChannels['token'].add(subscribed);
								return;
							}
						}
					} catch {
						// If an error occurs, send an error response back to the client.
						const output: MessageOutput = {
							type: 'subscribe',
							payload: {
								channel: parsed.payload.channel,
								params: parsed.payload.params,
								status: 'error'
							},
						};
						ws.send(CustomSuperJSON.stringify(output));
					}
				}

				/**
				 * Unsubscribe from a channel.
				 */
				case 'unsubscribe': {
					explorer.log.debug('WebSocket', 'Unsubscribe message received', parsed.payload);
					const { channel, params } = parsed.payload;
					try {
						switch (channel) {
							case 'account': {
								websocketUnsubscribeMessageAccount(ws, explorer, params?.id, subscribedChannels.account);
								return;
							}
	
							case 'token' : {
								websocketUnsubscribeMessageToken(ws, explorer, params?.id, subscribedChannels.token);
								return;
							}
						}
					} catch {
						// If an error occurs, send an error response back to the client.
						const output: MessageOutput = {
							type: 'unsubscribe',
							payload: {
								channel: parsed.payload.channel,
								params: parsed.payload.params,
								status: 'error'
							},
						};
						ws.send(CustomSuperJSON.stringify(output));
					}
					return;
				}

				/**
				 * Handle ping messages to keep the connection alive.
				 */
				case 'ping': {
					const timestamp = parsed.payload?.timestamp || Date.now();
					const response: MessageOutput = {
						type: 'pong',
						payload: {
							timestamp,
						},
					};
					ws.send(CustomSuperJSON.stringify(response));
					return;
				}
			}
		},

		/**
		 * Handle errors that occur during WebSocket communication.
		 */
		onError: (evt, ws) => {
			explorer.log.error('WebSocket', '🛑 Error', evt);
			ws.close(1000, 'Internal Server Error');
		},
	};
}

const websocket = new Hono<WorkerEnv>()
	.get('/health', (c) => {
		return c.json({ status: 'ok' });
	})

export default websocket;