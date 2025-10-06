import { useId, useRef } from 'react';

import { Signal, useComputed, useSignal, useSignalEffect } from '@preact/signals';
import { LoaderCircular, Typography } from '@keetanetwork/web-ui';
import { twMerge } from 'tailwind-merge';

type Props = {
	className?: string
	firstMessage?: string
	timerCustomId?: Signal<string>
};

const mapMessages = [
	'Loading ...',
	'Please wait a moment ...',
	'Still working on it ...',
	'Just a little bit longer ...',
	'Thanks for your patience, almost done!',
	'Sorry for the wait. Something’s taking longer than usual.',
	'This is taking too long. Please try refreshing the page.'
];

export function Loader({ className, firstMessage, timerCustomId }: Props) {
	const id = useId();
	const timerId = useComputed(() => timerCustomId ? timerCustomId.value : id);

	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const timerIdSubscription = useRef<string>();
	const messageIndex = useSignal(0);
	const message = useComputed(() => {
		// Return the current message based on the message index
		if (messageIndex.value === 0 && firstMessage) {
			// If the first message is set, return it
			return firstMessage;
		} else if (messageIndex.value < mapMessages.length) {
			return mapMessages[messageIndex.value];
		} else {
			// If the index exceeds the length of mapMessages, return the last message
			return mapMessages[mapMessages.length - 1];
		}
	});

	useSignalEffect(() => {
		// Clear the interval if it exists
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
		}

		// Subscribe to the timerId signal
		timerIdSubscription.current = timerId.value;

		// Set up an interval to update the loader every second
		intervalRef.current = setInterval(() => {
			if (messageIndex.value < mapMessages.length - 1) {
				// Increment the message index
				if (message)
				messageIndex.value += 1;
			} else {
				// If the last message is reached, clear the interval
				clearInterval(intervalRef.current!);
			}
		}, 10_000); // 10 seconds

		// Clear the interval when the component unmounts
		return(() => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				messageIndex.value = 0; // Reset the message index
				intervalRef.current = null; // Clear the reference
			}
		});
	});

	return(<>
		<LoaderCircular className="size-7 opacity-60" />

		<Typography className={twMerge("text-center text-balance", className)}>
			{message}
		</Typography>
	</>);
}
