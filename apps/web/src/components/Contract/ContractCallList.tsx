import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { ComponentChildren } from 'preact';
import { twMerge } from 'tailwind-merge';
import { Typography } from '@keetanetwork/web-ui';
import { Numeric } from '@keetanetwork/web-ui/helpers/Numeric';
import type { ContractCallDetails, ContractEffectDetails, DecodedOrError, StateAccountDetails } from '@keetanetwork/explorer-client';
import { TextAccountLink } from '@/components/TextAccountLink';
import { TextBlockLink } from '@/components/TextBlockLink';
import { CopyButton } from '@/components/CopyButton';
import TokenAmount from '@/components/TokenAmount';
import middleSubstring from '@/helpers/middleSubstring';
import { formatInteger } from '@/helpers/contract';
import { DecodedValueView, InlineValue, textClass } from './DecodedValue';

dayjs.extend(relativeTime);

export function StatusPill({ tone, children, title }: { tone: 'success' | 'error' | 'neutral' | 'warning', children: ComponentChildren, title?: string }) {
	return(<span
		title={title}
		className={twMerge(
			'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
			tone === 'success' && 'bg-success/10 text-success border border-success/40',
			tone === 'error' && 'bg-error/10 text-error border border-error/40',
			tone === 'warning' && 'bg-primary/15 text-secondary border border-primary/60',
			tone === 'neutral' && 'bg-slate-100 text-slate-600 border border-slate-200'
		)}
	>
		{children}
	</span>);
}

export function HexValue({ hex, chars = 12 }: { hex: string, chars?: number }) {
	if (hex.length === 0) {
		return(<span className='text-slate-500'>(empty)</span>);
	}
	return(<span className='inline-flex items-center gap-1 [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>
		{middleSubstring(hex, chars)}
		<CopyButton text={hex} />
	</span>);
}

/**
 * A call's instruction: decoded with the contract's interface, or raw
 */
export function Instruction({ instruction, data }: { instruction: DecodedOrError | null, data: string }) {
	if (instruction && 'decoded' in instruction) {
		return(<div className={twMerge(textClass, 'whitespace-normal')}><InlineValue value={instruction.decoded} /></div>);
	}
	return(<div className={twMerge(textClass, 'flex items-center gap-2')}>
		<HexValue hex={data} />
		{instruction && 'error' in instruction && <span className='text-error' title={instruction.error}>(does not decode)</span>}
	</div>);
}

function Label({ children }: { children: ComponentChildren }) {
	return(<Typography size="sm" className='text-slate-500 whitespace-nowrap'>{children}</Typography>);
}

function Effect({ effect }: { effect: ContractEffectDetails }) {
	if (effect.kind === 'send') {
		return(<div className='flex flex-wrap items-center gap-2'>
			<Typography size="sm" weight='semibold'>Send</Typography>
			<TokenAmount amount={new Numeric(BigInt(effect.amount))} tokenPublicKey={effect.token} />
			<Label>from</Label>
			<TextAccountLink publicKey={effect.from} truncateChars={8} />
			<Label>to</Label>
			<TextAccountLink publicKey={effect.to} truncateChars={8} />
			{effect.external && <Label>(external {effect.external})</Label>}
		</div>);
	}
	return(<div className='flex flex-wrap items-center gap-2'>
		<Typography size="sm" weight='semibold'>Set info</Typography>
		<Label>of</Label>
		<TextAccountLink publicKey={effect.account} truncateChars={8} />
		<Typography size="sm">name "{effect.name}", description "{effect.description}"{effect.metadata ? `, metadata ${effect.metadata}` : ''}</Typography>
	</div>);
}

/**
 * A state account: its kind and decoded value, or its raw bytes
 */
export function StateAccountValue({ account }: { account: StateAccountDetails }) {
	if (account.data === null) {
		return(<Typography size="sm" className='text-slate-500'>Deleted</Typography>);
	}
	if (account.decoded) {
		return(<DecodedValueView value={account.decoded} />);
	}
	return(<div className={twMerge(textClass, 'flex flex-col gap-1')}>
		<HexValue hex={account.data} chars={24} />
		{account.error && <span className='text-error'>Does not decode as {account.kind}: {account.error}</span>}
	</div>);
}

export function StateAccountKind({ account }: { account: Pick<StateAccountDetails, 'kind' | 'matchedBy' | 'seeds' | 'alsoDecodesAs'> }) {
	if (!account.kind) {
		return(<StatusPill tone='neutral' title='No kind of account in the interface matches it'>unknown</StatusPill>);
	}

	const seeds = Object.entries(account.seeds ?? {});
	const title = account.matchedBy === 'seeds'
		? 'Its id is the one these seeds give'
		: `Its data decodes as this kind's type${account.alsoDecodesAs ? ` (and as ${account.alsoDecodesAs.join(', ')})` : ''}, but no seeds tried give its id`;

	return(<div className='flex flex-wrap items-center gap-2'>
		<Typography size="sm" weight='semibold'>{account.kind}</Typography>
		{account.matchedBy === 'type' && <StatusPill tone='warning' title={title}>by type</StatusPill>}
		{seeds.map(([name, address]) => (
			<span key={name} className='inline-flex items-center gap-1' title={title}>
				<Label>{name}</Label>
				<TextAccountLink publicKey={address} truncateChars={6} />
			</span>
		))}
	</div>);
}

function Detail({ label, children }: { label: string, children: ComponentChildren }) {
	return(<div className='contents'>
		<Label>{label}</Label>
		<div className='flex flex-col gap-2 min-w-0'>{children}</div>
	</div>);
}

function CallDetails({ call }: { call: ContractCallDetails }) {
	const { outcome } = call;
	return(<div className='grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 pt-3'>
		<Detail label='Instruction data'><div className={textClass}><HexValue hex={call.data} chars={24} /></div></Detail>

		<Detail label='Accounts'>
			{call.accounts.length === 0 && <Typography size="sm">None</Typography>}
			{call.accounts.map((account, index) => (
				<div key={index} className='flex flex-wrap items-center gap-2'>
					<Typography size="sm" weight='semibold'>{account.kind ?? 'unknown'}</Typography>
					<StatusPill tone='neutral'>{account.writable ? 'writable' : 'read-only'}</StatusPill>
					<div className={textClass}><HexValue hex={account.id} /></div>
					{account.owner !== call.contract && <><Label>of</Label><TextAccountLink publicKey={account.owner} truncateChars={6} /></>}
				</div>
			))}
		</Detail>

		{outcome && (
			<>
				<Detail label='Writes'>
					{outcome.writes.length === 0 && <Typography size="sm">None</Typography>}
					{outcome.writes.map((write, index) => (
						<div key={index} className='flex flex-col gap-1 border-l-2 border-slate-100 pl-3'>
							<div className='flex flex-wrap items-center gap-2'>
								<StateAccountKind account={write} />
								<Label>version {write.version}</Label>
							</div>
							<StateAccountValue account={write} />
						</div>
					))}
				</Detail>

				<Detail label='Effects'>
					{outcome.effects.length === 0 && <Typography size="sm">None</Typography>}
					{outcome.effects.map((effect, index) => <Effect key={index} effect={effect} />)}
				</Detail>

				<Detail label='Reads'>
					{outcome.reads.length === 0 && <Typography size="sm">None</Typography>}
					{outcome.reads.length > 0 && (
						<Typography size="sm">
							{outcome.reads.map(read => `${read.kind ?? middleSubstring(read.id, 6)} (version ${read.version})`).join(', ')}
						</Typography>
					)}
				</Detail>

				{(outcome.returnData.length > 0 || outcome.returned) && (
					<Detail label='Returned'>
						{outcome.returned && 'decoded' in outcome.returned
							? <DecodedValueView value={outcome.returned.decoded} />
							: <div className={textClass}><HexValue hex={outcome.returnData} chars={24} /></div>}
					</Detail>
				)}
			</>
		)}
	</div>);
}

/**
 * Contract calls, each with its decoded instruction and outcome; failed
 * calls are marked, with the contract's message
 */
export function ContractCallList({ calls, showContract = false }: { calls: ContractCallDetails[], showContract?: boolean }) {
	return(<div className='divide-y divide-slate-100'>
		{calls.map(call => {
			const { outcome } = call;
			const failed = outcome?.failure ?? null;
			return(<div key={`${call.block}:${call.operationIndex}`} className={twMerge('p-4 flex flex-col gap-2', failed && 'bg-error/5')}>
				<div className='flex flex-wrap items-center justify-between gap-3'>
					<div className='flex flex-wrap items-center gap-3 min-w-0'>
						{!outcome && <StatusPill tone='neutral' title="The staple's votes carry no outcome for this call">No outcome</StatusPill>}
						{outcome && !failed && <StatusPill tone='success'>Success</StatusPill>}
						{failed && <StatusPill tone='error' title={failed.kind}>Failed</StatusPill>}
						<Instruction instruction={call.instruction} data={call.data} />
					</div>
					<div className='flex flex-wrap items-center gap-3'>
						<Typography size="sm" className='text-slate-500'>
							Gas {outcome ? `${formatInteger(outcome.gasUsed)} of ` : 'limit '}{formatInteger(call.gasLimit)}
						</Typography>
						<span title={call.date}><Typography size="sm" className='text-slate-500'>{dayjs(call.date).fromNow()}</Typography></span>
					</div>
				</div>

				<div className='flex flex-wrap items-center gap-x-6 gap-y-1'>
					<span className='inline-flex items-center gap-2'><Label>Caller</Label><TextAccountLink publicKey={call.caller} truncateChars={8} /></span>
					{showContract && <span className='inline-flex items-center gap-2'><Label>Contract</Label><TextAccountLink publicKey={call.contract} truncateChars={8} /></span>}
					<span className='inline-flex items-center gap-2'><Label>Block</Label><TextBlockLink blockhash={call.block} truncateChars={6} /></span>
					{call.funds.length > 0 && (
						<span className='inline-flex items-center gap-2'>
							<Label>Funds</Label>
							{call.funds.map(fund => <TokenAmount key={fund.token} amount={new Numeric(BigInt(fund.amount))} tokenPublicKey={fund.token} />)}
						</span>
					)}
				</div>

				{failed && (
					<div className='rounded-md border border-error/40 bg-error/10 px-3 py-2'>
						<Typography size="sm" className='text-error whitespace-normal'>
							<span className='font-semibold'>Refused ({failed.kind}):</span> {failed.message}
						</Typography>
						<Typography size="xs" className='text-error mt-1 whitespace-normal'>
							The call still landed and paid its whole gas limit; it wrote nothing, and its only effects return its funds.
						</Typography>
					</div>
				)}

				<details className='group'>
					<summary className='cursor-pointer list-none text-functional-focused'>
						<Typography size="sm" weight='semibold' className='inline group-open:hidden'>Show details</Typography>
						<Typography size="sm" weight='semibold' className='hidden group-open:inline'>Hide details</Typography>
					</summary>
					<CallDetails call={call} />
				</details>
			</div>);
		})}
	</div>);
}
