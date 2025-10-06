import type { MessageInput, MessageType, MessageOutput, MessageChannel } from "./types";
import { messageType, messageChannel } from "./types";

/**
 * Helpers
 */
export function isMessageInput(data: unknown): data is MessageInput {
	return typeof data === 'object'
			&& data !== null

			// Check if data has the required properties
			&& 'type' in data
			&& 'payload' in data
			&& typeof data.type === 'string'
			&& typeof data.payload === 'object'
			&& data.payload !== null

			// Validate message type
			&& Object.values(messageType).includes(data.type as MessageType)
			
			// Validate channels for subscribe and unsubscribe messages
			&& (
				(
					data.type === 'subscribe'
					|| data.type === 'unsubscribe'
				) ? (
					'channel' in data.payload
					&& typeof data.payload.channel === 'string'
					&& Object.values(messageChannel).includes(data.payload.channel as MessageChannel)
				) : true
			);
}

export function isMessageOutput(data: unknown): data is MessageOutput {
	return typeof data === 'object'
			&& data !== null
			
			// Check if data has the required properties
			&& 'type' in data
			&& 'payload' in data
			&& typeof data.type === 'string'
			&& typeof data.payload === 'object'
			&& data.payload !== null
			
			// Validate message type
			&& (data.type === 'pong' || data.type === "message" || Object.values(messageType).includes(data.type as MessageType))
			&& (
				// Validate payload for subscribe and unsubscribe messages
				(data.type === 'subscribe' || data.type === 'unsubscribe' || data.type === 'message')
					? ('channel' in data.payload && typeof data.payload.channel === 'string')
					: true
			);
}