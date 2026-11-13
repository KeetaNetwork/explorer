import type { DecodedField, DecodedValue } from '@keetanetwork/explorer-client';
import { Typography } from '@keetanetwork/web-ui';
import { twMerge } from 'tailwind-merge';
import { TextAccountLink } from '@/components/TextAccountLink';
import { CopyButton } from '@/components/CopyButton';
import middleSubstring from '@/helpers/middleSubstring';
import { formatInteger } from '@/helpers/contract';

/** Elements of a sequence shown before the rest are counted */
const MAX_ELEMENTS = 8;

const punctuation = 'text-slate-400';

/** Text like Typography's, for blocks that hold links (which Typography's paragraphs cannot) */
export const textClass = 'text-sm font-surt-normal';

function isUnitVariant(value: DecodedValue): boolean {
	return(value.kind === 'enum' && value.fields.length === 0);
}

function Fields({ fields }: { fields: DecodedField[] }) {
	const named = fields.every(field => field.name !== null);
	return(<>
		<span className={punctuation}>{named ? '{ ' : '('}</span>
		{fields.map((field, index) => (
			<span key={index} className='inline-flex items-center gap-1'>
				{field.name !== null && <span className='text-slate-500'>{field.name}:</span>}
				<InlineValue value={field.value} />
				{index < fields.length - 1 && <span className={punctuation}>,&nbsp;</span>}
			</span>
		))}
		<span className={punctuation}>{named ? ' }' : ')'}</span>
	</>);
}

/**
 * A decoded value on one line: `Adopt { name: "Rex" }`, `[1, 2]`, ...
 */
export function InlineValue({ value }: { value: DecodedValue }) {
	switch (value.kind) {
		case 'integer':
			return(<span className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]' title={value.type}>{formatInteger(value.value)}</span>);
		case 'float':
			return(<span className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]' title={value.type}>{value.value}</span>);
		case 'bool':
			return(<span className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{value.value ? 'true' : 'false'}</span>);
		case 'unit':
			return(<span className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>()</span>);
		case 'string':
			return(<span className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-success'>"{value.value}"</span>);
		case 'address':
			return(<TextAccountLink publicKey={value.value} truncateChars={8} className='inline-flex' />);
		case 'bytes':
			return(<span className='inline-flex items-center gap-1 [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]' title={value.type}>
				0x{middleSubstring(value.hex, 8)}
				{value.hex.length > 16 && <CopyButton text={value.hex} />}
			</span>);
		case 'struct':
			if (value.fields.length === 0) {
				return(<span className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{value.type}</span>);
			}
			return(<span className='inline-flex flex-wrap items-center gap-y-1'><Fields fields={value.fields} /></span>);
		case 'enum':
			return(<span className='inline-flex flex-wrap items-center gap-y-1'>
				<span className='font-semibold'>{value.variant}</span>
				{value.fields.length > 0 && <>&nbsp;<Fields fields={value.fields} /></>}
			</span>);
		case 'sequence':
		case 'tuple': {
			const [open, close] = value.kind === 'sequence' ? ['[', ']'] : ['(', ')'];
			const shown = value.elements.slice(0, MAX_ELEMENTS);
			return(<span className='inline-flex flex-wrap items-center gap-y-1'>
				<span className={punctuation}>{open}</span>
				{shown.map((element, index) => (
					<span key={index} className='inline-flex items-center'>
						<InlineValue value={element} />
						{index < value.elements.length - 1 && <span className={punctuation}>,&nbsp;</span>}
					</span>
				))}
				{value.elements.length > MAX_ELEMENTS && <span className='text-slate-500'>{value.elements.length - MAX_ELEMENTS} more</span>}
				<span className={punctuation}>{close}</span>
			</span>);
		}
	}
}

/**
 * A decoded value laid out as a list of its fields, one per line (for
 * state accounts); values without fields are shown inline
 */
export function DecodedValueView({ value, className }: { value: DecodedValue, className?: string }) {
	const fields = value.kind === 'struct' || (value.kind === 'enum' && !isUnitVariant(value)) ? value.fields : null;
	if (!fields || fields.length === 0 || fields.some(field => field.name === null)) {
		return(<div className={twMerge(textClass, className)}><InlineValue value={value} /></div>);
	}

	return(<div className={twMerge('grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1', className)}>
		{value.kind === 'enum' && (
			<Typography size="sm" weight='semibold' className='col-span-2'>{value.variant}</Typography>
		)}
		{fields.map((field, index) => (
			<div key={index} className='contents'>
				<Typography size="sm" className='text-slate-500'>{field.name}</Typography>
				<div className={twMerge(textClass, 'whitespace-normal break-all')}><InlineValue value={field.value} /></div>
			</div>
		))}
	</div>);
}
