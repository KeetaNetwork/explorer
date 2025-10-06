import WebSocket from 'isomorphic-ws';
import { isMessageOutput } from '@/api/websocket/helpers';
import type { ExplorerSDK } from '.';
import type { MessageChannel, MessageInput, MessageResponsePayload, MessageResponsePayloadData } from '@/api/websocket/types';
import { CustomSuperJSON } from '@/utils/json';

/**
 * Types
 */
export type SDKWebSocketState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';
type SDKEventMessage<T extends string> = `message-${T}`;
type SDKMessageEvent = SDKEventMessage<MessageChannel> | "state-change"
type SDKMessageListenerData = {
	[K in MessageChannel as `message-${K}`]: MessageResponsePayloadData[K];
} & {
	"state-change": SDKWebSocketState;
};

/**
 * WebSocket Config
 */
interface ExplorerSDKWebSocketConfig {
	/**
	 * Should the WebSocket client attempt to reconnect if the connection is lost?
	 */
	shouldReconnect?: boolean;

	/**
	 * Delay in milliseconds before attempting to reconnect
	 */
	reconnectDelay?: number;
}

const DEFAULT_WS_CONFIG: Required<ExplorerSDKWebSocketConfig> = {
	shouldReconnect: true,
	reconnectDelay: 5_000,
};

/**
 * WebSocket client for the Explorer SDK
 */
export class ExplorerSDKWebSocket {
	// WebSocket client instance
	private wsClient!: WebSocket;

	// Configuration for the WebSocket client
	private config: Required<ExplorerSDKWebSocketConfig>;

	// Interval for periodic pings
	private interval: NodeJS.Timeout | undefined;

	// Storage for subscribed channels
	private subscribedChannels = new Map<MessageChannel, Set<string>>();

	// Listener storage for different message channels
	private listeners: { [channel in SDKMessageEvent]?: Map<Symbol, (...payload: any) => void> } = {};

	// State of the WebSocket connection
	public state: SDKWebSocketState = 'CLOSED';

	constructor(
		private sdk: ExplorerSDK,
		config: ExplorerSDKWebSocketConfig = {}
	) {
		this.config = { 
			...DEFAULT_WS_CONFIG,
			...config
		};
		
		this.connect();
	}
	
	private connect() {
		const url = new URL(`${this.sdk.config.baseURL}ws`);
		url.search = new URLSearchParams(this.sdk.config.networkConfig as Record<string, string>).toString();
		
		this.wsClient = new WebSocket(url);
		this.emitStateChange('CONNECTING');
		this.addEventListeners();
	}
	
	/**
	 * Add event listeners to the WebSocket client.
	 */
	private addEventListeners() {
		/**
		 * Event listener for when the WebSocket connection is opened.
		 */
		this.wsClient.addEventListener('open', async () => {
			this.interval = setInterval(() => {
				if (this.wsClient.readyState === WebSocket.OPEN) {
					const pingMessage: MessageInput = {
						type: 'ping',
						payload: {}
					};
					this.wsClient.send(CustomSuperJSON.stringify(pingMessage));
				}
			}, 30_000); // Ping every 30 seconds

			// Subscribe to channels that were previously subscribed
			const promises: Promise<any>[] = [];
			for (const [channel, paramsSet] of this.subscribedChannels.entries()) {
				for (const id of paramsSet) {
					promises.push(
						this.subscribe(channel, { id }).catch((error) => {
							console.error('[ExplorerSDKWebSocket]', 'Failed to resubscribe to channel', channel, 'with id', id, error);
						})
					);
				}
			}

			// Wait for all subscriptions to be established
			if (promises.length > 0) {
				await Promise.all(promises);
			}
			
			// Emit state change event
			this.emitStateChange('OPEN');
		});

		/**
		 * Event listener for when the WebSocket connection is closed.
		 */
		this.wsClient.addEventListener('close', (event) => {
			this.emitStateChange('CLOSED');

			// Clear the ping interval
			if (this.interval) {
				clearInterval(this.interval);
				this.interval = undefined;
			}

			// Reconnect
			this.reconnect();
		});
		
		/**
		 * Event listener for when the WebSocket receives a message.
		 */
		this.wsClient.addEventListener('message', (event) => {
			const data = CustomSuperJSON.parse(event.data.toString());
			if (!isMessageOutput(data)) {
				console.error('[ExplorerSDKWebSocket]', 'Invalid message format', event.data);
				return;
			}

			if (data.type === "message") {
				this.emitMessage(data.payload);
			}
		});

		/**
		 * Event listener for when the WebSocket encounters an error.
		 */
		this.wsClient.addEventListener('error', (error) => {
			console.error('[ExplorerSDKWebSocket]', 'WebSocket error', error);
		});
	}

	/**
	 * Reconnect to the WebSocket server.
	 */
	private reconnect() {
		this.emitStateChange('CONNECTING');
		
		if (this.config.shouldReconnect) {
			setTimeout(() => {
				this.connect();
			}, this.config.reconnectDelay);
		}
	}

	/**
	 * Wait for the WebSocket client to be ready.
	 */
	private async awaitReady() {
		return new Promise<void>((resolve, reject) => {
			if (this.wsClient.readyState === WebSocket.OPEN) {
				resolve();
				return;
			}

			setTimeout(() => {
				if (this.wsClient.readyState === WebSocket.OPEN) {
					resolve();
				}
			}, 1000);
		});
	}

	/**
	 * Channels are used to subscribe to specific data streams.
	 */
	// Subscribe to a channel with the given parameters.
	async subscribe(channel: MessageChannel, params: Record<string, any>) {
		await this.awaitReady();

		await sendAndWaitForResponse(this.wsClient, 'subscribe', channel, params)
		
		const channelList = this.subscribedChannels.get(channel)
		if (!channelList) {
			this.subscribedChannels.set(channel, new Set([params.id]));
		} else {
			channelList.add(params.id);
		}
	}

	// Unsubscribe from a channel with the given parameters.
	async unsubscribe(channel: MessageChannel, params: Record<string, any>) {
		await this.awaitReady();

		await sendAndWaitForResponse(this.wsClient, 'unsubscribe', channel, params);

		// Remove listeners for the channel
		const channelListeners = this.listeners[`message-${channel}`];
		if (channelListeners) {
			this.listeners[`message-${channel}`] = new Map();
		}

		// Remove the channel from the subscribed channels map
		const channelList = this.subscribedChannels.get(channel);
		if (channelList) {
			channelList.delete(params.id);
			if (channelList.size === 0) {
				this.subscribedChannels.delete(channel);
			}
		}
	}
	
	/**
	 * Event listener.
	 */
	// Add an event listener for a specific message event.
	on<E extends SDKMessageEvent>(eventName: E, listener: (data: SDKMessageListenerData[E]) => void) {
		const channelListeners = this.listeners[eventName];
		if (!channelListeners) {
			this.listeners[eventName] = new Map();
		}

		const symbol = Symbol('listener');

		this.listeners[eventName]!.set(symbol, listener);

		return symbol;
	}

	// Remove an event listener by its symbol.
	off(symbol: Symbol) {
		for (const eventName in this.listeners) {
			const eventListeners = this.listeners[eventName as SDKMessageEvent];
			if (eventListeners && eventListeners.has(symbol)) {
				eventListeners.delete(symbol);
				if (eventListeners.size === 0) {
					delete this.listeners[eventName as SDKMessageEvent];
				}
				return;
			}
		}
	}

	// Remove all listeners for all events.
	removeAllListeners() {
		for (const eventName in this.listeners) {
			const eventListeners = this.listeners[eventName as SDKMessageEvent];
			if (eventListeners) {
				eventListeners.clear();
				delete this.listeners[eventName as SDKMessageEvent];
			}
		}
	}

	/**
	 * Event emitter for messages received from the WebSocket.
	 */
	private emitMessage(payload: MessageResponsePayload) {
		const listeners = this.listeners[`message-${payload.channel}`]
		if (!listeners) {
			return;
		}

		for (const listener of listeners.values()) {
			listener(payload.data);
		}
	}

	/**
	 * Event emitter for state changes.
	 */
	private emitStateChange(state: SDKWebSocketState) {
		this.state = state;
		const listeners = this.listeners['state-change'];
		if (!listeners) {
			return;
		}

		for (const listener of listeners.values()) {
			listener(state);
		}
	}
}


function sendAndWaitForResponse(ws: WebSocket, type: "subscribe" | "unsubscribe", channel: MessageChannel, params: Record<string, any>) {
	return new Promise((resolve, reject) => {
		// Handle the subscription message
		const handler = (event: WebSocket.MessageEvent) => {
			const data = CustomSuperJSON.parse(event.data.toString());
			if (!isMessageOutput(data)) {
				return;
			}

			if (data.type === type && data.payload.channel === channel) {
				if (data.payload.status === "success") {
					resolve(data.payload);
				} else if (data.payload.status === "error") {
					reject(new Error(data.payload.channel));
				}
				ws.removeEventListener('message', handler);
			}
		}

		// Listen for messages from the WebSocket
		ws.addEventListener('message', handler);
		
		// Send the subscription request
		const input: MessageInput = {
			type: type,
			payload: {
				channel,
				params,
			}
		}
		ws.send(CustomSuperJSON.stringify(input));
	})
}