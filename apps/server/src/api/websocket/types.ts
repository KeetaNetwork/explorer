import type { KeetaNetLib } from "@/utils/keetanet";

type P2PSwitch = InstanceType<typeof KeetaNetLib.lib.P2P>;
type UserClient = InstanceType<typeof KeetaNetLib.UserClient>;

/**
 * Types
 */
export const messageType = ['subscribe', 'unsubscribe', 'ping'] as const;
export type MessageType = typeof messageType[number];

export const messageChannel = ['account', 'token'] as const;
export type MessageChannel = typeof messageChannel[number];

/**
 * Types for incoming messages
 */
interface MessageSubscribeInput {
	type: 'subscribe';
	payload: {
		channel: MessageChannel;
		params?: { id?: string }
	}
}

interface MessageUnsubscribeInput {
	type: 'unsubscribe';
	payload: {
		channel: MessageChannel;
		params?: { id?: string }
	}
}

interface MessagePingInput {
	type: 'ping';
	payload?: {
		timestamp?: number;
	}
}

export type MessageInput = MessageSubscribeInput | MessageUnsubscribeInput | MessagePingInput;

/**
 * Types for outgoing messages
 */
interface MessageSubscribeOutput {
	type: 'subscribe';
	payload: {
		channel: MessageChannel;
		params?: { id?: string };
		status: 'success' | 'error';
	}
}

interface MessageUnsubscribeOutput {
	type: 'unsubscribe';
	payload: {
		channel: MessageChannel;
		params?: { id?: string };
		status: 'success' | 'error';
	}
}

interface MessagePingOutput {
	type: 'pong';
	payload: {
		timestamp: number;
	}
}

interface MessageAccountPayload {
	channel: 'account';
	data: {
		accountPublicKey: string;
		currentHeadBlock: string | null;
	}
}

interface MessageTokenPayload {
	channel: 'token';
	data: {
		tokenPublicKey: string;
		currentHeadBlock: string | null;
	}
}

export type MessageResponsePayloadData = {
	'token': MessageTokenPayload['data'];
	'account': MessageAccountPayload['data'];
}

export type MessageResponsePayload = MessageAccountPayload | MessageTokenPayload;

interface MessageResponseOutput {
	type: 'message';
	payload: MessageResponsePayload;
}

export type MessageOutput = MessageSubscribeOutput | MessageUnsubscribeOutput | MessagePingOutput | MessageResponseOutput;

/**
 * 
 */
export interface AccountSubscription {
    id: string;
    subscription: symbol;
    userClient: UserClient;
}

export interface P2PSwitchSubscription {
	p2pSwitch: P2PSwitch;
	interval: NodeJS.Timeout;
}