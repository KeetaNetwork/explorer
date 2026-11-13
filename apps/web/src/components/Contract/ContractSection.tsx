import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@preact-signals/query';
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { twMerge } from 'tailwind-merge';
import { LoaderCircular, Typography } from '@keetanetwork/web-ui';
import { ClientNotFoundError, type ContractInterface, type ContractVerificationStatus, type ExplorerContractsSDK } from '@keetanetwork/explorer-client';
import { useClientSDK } from '@/providers/ClientProvider';
import { CardContainer } from '@/components/CardContainer';
import { ContentCard } from '@/components/ContentCard';
import { CopyButton } from '@/components/CopyButton';
import { TextBlockLink } from '@/components/TextBlockLink';
import Button from '@/components/core/Button';
import Input from '@/components/core/Input';
import Toast from '@/components/core/Toast';
import middleSubstring from '@/helpers/middleSubstring';
import { completeDate } from '@/helpers/date';
import { formatBytes } from '@/helpers/contract';
import { ContractCallList, HexValue, StateAccountKind, StateAccountValue, StatusPill } from './ContractCallList';
import { textClass } from './DecodedValue';

type ContractVerificationResponse = ContractVerificationStatus & { matchesCode: boolean };

function Box({ children, className }: { children: ComponentChildren, className?: string }) {
	return(<div className={twMerge('p-4', className)}>{children}</div>);
}

function Muted({ children, className }: { children: ComponentChildren, className?: string }) {
	return(<Typography size="sm" className={`text-slate-500 whitespace-normal ${className ?? ''}`}>{children}</Typography>);
}

function CardLoader() {
	return(<Box className='flex justify-center'><LoaderCircular /></Box>);
}

function errorMessage(error: unknown): string {
	return(error instanceof Error ? error.message : String(error));
}

/**
 * The code hash, marked verified when the verifier rebuilt this code
 */
function CodeHash({ codeHash, verification }: { codeHash: string, verification: ContractVerificationResponse | null | undefined }) {
	const verified = verification?.verification && verification.matchesCode;
	return(<div className='flex flex-wrap items-center gap-2 justify-end'>
		<Typography size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{middleSubstring(codeHash, 10)}</Typography>
		<CopyButton text={codeHash} />
		{verification === undefined && <LoaderCircular className='size-4' />}
		{verified && <StatusPill tone='success' title='The verifier built this code from its source'>Verified</StatusPill>}
		{verification && !verified && <StatusPill tone='neutral'>Not verified</StatusPill>}
	</div>);
}

function useContractVerification(contracts: ExplorerContractsSDK, contract: string, enabled: boolean) {
	return(useQuery({
		queryKey: ['contract', contract, 'verification'],
		queryFn: async () => {
			const response = await contracts.verification(contract);
			return('verification' in response ? response.verification as ContractVerificationResponse | null : null);
		},
		enabled,
		refetchInterval: (data: ContractVerificationResponse | null | undefined) => data && (data.status === 'queued' || data.status === 'running') ? 5_000 : false
	}));
}

/**
 * Where the code was verified from
 */
function VerificationSource({ source }: { source: NonNullable<ContractVerificationStatus['verification']>['source'] }) {
	if ('local' in source) {
		return(<div className='flex flex-col items-end gap-1'>
			<StatusPill tone='warning' title='Verified from files on the verifier’s machine, not from a published repository'>Local working tree (development)</StatusPill>
			<Typography size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{source.local}</Typography>
		</div>);
	}
	const isWeb = /^https:\/\//.test(source.repository);
	return(<div className='flex flex-wrap items-center gap-2 justify-end'>
		{isWeb
			? <a href={source.repository.replace(/\.git$/, '')} target='_blank' rel='noreferrer' className='text-functional-focused'><Typography size="sm" weight='semibold'>{source.repository}</Typography></a>
			: <Typography size="sm">{source.repository}</Typography>}
		<Muted>at</Muted>
		<Typography size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{source.commit.slice(0, 12)}</Typography>
		<CopyButton text={source.commit} />
	</div>);
}

function SubmitVerificationForm({ contracts, contract }: { contracts: ExplorerContractsSDK, contract: string }) {
	const queryClient = useQueryClient();
	const [form, setForm] = useState({ repository: '', commit: '', package: '', manifestPath: '' });
	const { mutate, isLoading } = useMutation({
		mutationFn: async () => await contracts.submitVerification(contract, {
			repository: form.repository.trim(),
			commit: form.commit.trim().toLowerCase(),
			package: form.package.trim(),
			...(form.manifestPath.trim() ? { manifestPath: form.manifestPath.trim() } : {})
		}),
		onError: (error: unknown) => {
			Toast.error(`Not submitted: ${errorMessage(error)}`);
		},
		onSuccess: () => {
			Toast.success('Submitted for verification');
			void queryClient.invalidateQueries({ queryKey: ['contract', contract, 'verification'] });
		}
	});

	const field = (name: keyof typeof form, label: string, placeholder: string, required = true) => (
		<label className='flex flex-col gap-1'>
			<Typography size="sm" className='text-slate-500'>{label}{required ? '' : ' (optional)'}</Typography>
			<Input
				value={form[name]}
				placeholder={placeholder}
				required={required}
				onInput={(event) => setForm({ ...form, [name]: (event.target as HTMLInputElement).value })}
			/>
		</label>
	);

	return(<form
		className='flex flex-col gap-3'
		onSubmit={(event) => {
			event.preventDefault();
			mutate();
		}}
	>
		<Muted>Submit the contract's source to the verifier, which builds it and checks the build is the deployed code.</Muted>
		<div className='grid gap-3 md:grid-cols-2'>
			{field('repository', 'Repository (https git URL)', 'https://github.com/org/repo.git')}
			{field('commit', 'Commit (40-character hash)', '0123456789abcdef0123456789abcdef01234567')}
			{field('package', 'Cargo package', 'my-contract')}
			{field('manifestPath', 'Manifest path', 'contracts/Cargo.toml', false)}
		</div>
		<div>
			<Button type='submit' size='small' loading={isLoading} disabled={isLoading}>Submit for verification</Button>
		</div>
	</form>);
}

function VerificationCard({ contracts, contract, query }: { contracts: ExplorerContractsSDK, contract: string, query: ReturnType<typeof useContractVerification> }) {
	const { data, isLoading, error } = query;

	if (isLoading) {
		return(<CardContainer title="Verification"><CardLoader /></CardContainer>);
	}
	if (error || !data) {
		return(<CardContainer title="Verification">
			<Box><Muted>The verifier could not be reached{error ? `: ${errorMessage(error)}` : ''}.</Muted></Box>
		</CardContainer>);
	}

	const { verification, status, lastAttempt } = data;
	const verified = verification && data.matchesCode;
	const statusPill = verified
		? <StatusPill tone='success'>Verified</StatusPill>
		: status === 'queued' || status === 'running'
			? <StatusPill tone='warning'>{status === 'queued' ? 'Queued' : 'Running'}</StatusPill>
			: status === 'failed'
				? <StatusPill tone='error'>Failed</StatusPill>
				: <StatusPill tone='neutral'>Not verified</StatusPill>;

	const attemptError = lastAttempt && typeof lastAttempt.error === 'string' ? lastAttempt.error : null;

	return(<>
		<ContentCard
			title="Verification"
			content={[
				{ label: 'Status', type: 'jsx', value: <div className='flex items-center gap-2'>{statusPill}{(status === 'queued' || status === 'running') && <LoaderCircular className='size-4' />}</div> },
				...(verification ? [
					...(!data.matchesCode ? [{ label: 'Note', value: `Verified code ${middleSubstring(verification.codeHash, 8)}, not the code deployed now` }] : []),
					{ label: 'Source', type: 'jsx' as const, value: <VerificationSource source={verification.source} /> },
					{ label: 'Package', value: verification.package },
					{ label: 'Manifest', value: verification.manifestPath ?? null },
					{ label: 'Builder image', value: verification.builder?.image ?? null },
					{ label: 'Builder platform', value: verification.builder?.platform ?? null },
					{ label: 'Agave', value: verification.builder?.agave ?? null },
					{ label: 'Platform tools', value: verification.builder?.platformTools ?? null },
					{ label: 'Dockerfile SHA-256', type: 'jsx' as const, value: verification.builder?.dockerfileSha256 ? <HexValue hex={verification.builder.dockerfileSha256} chars={10} /> : undefined },
					{ label: 'Verified', type: 'datetime' as const, value: new Date(verification.verifiedAt) }
				] : []),
				{ label: 'Verifier error', value: data.error },
				{ label: 'Last attempt', value: attemptError }
			]}
		/>

		{!verified && (
			<CardContainer title="Submit for verification" hasToggle={status === 'none' ? 'open' : true}>
				<Box><SubmitVerificationForm contracts={contracts} contract={contract} /></Box>
			</CardContainer>
		)}
	</>);
}

/**
 * The interface's types, written out like their Rust definitions
 */
function describeType(name: string, definition: ContractInterface['types'][string]): string {
	switch (definition.kind) {
		case 'primitive':
			return(`primitive ${name} (${definition.size} bytes)`);
		case 'address':
			return(`${name}: address (34 bytes)`);
		case 'struct': {
			if (definition.fields.length === 0) {
				return(`struct ${name};`);
			}
			if (definition.fields.every(field => typeof field === 'string')) {
				return(`struct ${name}(${definition.fields.join(', ')});`);
			}
			const fields = definition.fields.map(field => typeof field === 'string' ? `    ${field},` : `    ${field.name}: ${field.type},`);
			return(`struct ${name} {\n${fields.join('\n')}\n}`);
		}
		case 'enum': {
			const variants = definition.variants.map(variant => `    ${variant.name}${variant.type ? `(${variant.type})` : ''} = ${variant.discriminant},`);
			return(`enum ${name} /* tag: ${definition.tagWidth ?? 1} bytes */ {\n${variants.join('\n')}\n}`);
		}
		case 'sequence':
			if (definition.length !== undefined) {
				return(`type ${name} = [${definition.elements}; ${definition.length}];`);
			}
			return(`type ${name} = Vec<${definition.elements}>; /* length: ${definition.lengthWidth ?? 4} bytes */`);
		case 'tuple':
			return(`type ${name} = (${definition.elements.join(', ')});`);
	}
}

function Code({ children, className }: { children: string, className?: string }) {
	return(<pre className={twMerge('[font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-[13px] leading-5 whitespace-pre overflow-x-auto bg-slate-50 rounded-md p-3', className)}>{children}</pre>);
}

function InterfaceCard({ contractInterface }: { contractInterface: ContractInterface }) {
	const [showJSON, setShowJSON] = useState(false);
	const types = Object.entries(contractInterface.types)
		.filter(([, definition]) => definition.kind !== 'primitive' && definition.kind !== 'address')
		.map(([name, definition]) => describeType(name, definition));

	return(<CardContainer title={`Interface${contractInterface.name ? ` (${contractInterface.name})` : ''}`} hasToggle>
		<Box className='flex flex-col gap-4'>
			<div className='grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2'>
				<Muted>Instructions</Muted>
				<Typography size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{contractInterface.instruction ?? '(not described)'}</Typography>

				<Muted>State accounts</Muted>
				<div className='flex flex-col gap-1'>
					{contractInterface.accounts.length === 0 && <Typography size="sm">None described</Typography>}
					{contractInterface.accounts.map(account => (
						<Typography key={account.name} size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace] whitespace-normal'>
							{account.name}: {account.type}
							<span className='text-slate-500'>
								{' '}seeds [{(account.seeds ?? []).map(seed => 'bytes' in seed ? `"${new TextDecoder().decode(new Uint8Array(seed.bytes.match(/../g)?.map(byte => parseInt(byte, 16)) ?? []))}"` : `address ${seed.address}`).join(', ')}]
							</span>
						</Typography>
					))}
				</div>

				<Muted>Views</Muted>
				<div className='flex flex-col gap-1'>
					{contractInterface.views.length === 0 && <Typography size="sm">None</Typography>}
					{contractInterface.views.map(view => (
						<Typography key={view.instruction} size="sm" className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{view.instruction} → {view.returns}</Typography>
					))}
				</div>
			</div>

			<Code>{types.join('\n\n')}</Code>

			<div>
				<Button variant='text' size='small' onClick={() => setShowJSON(!showJSON)}>{showJSON ? 'Hide JSON' : 'Show JSON'}</Button>
			</div>
			{showJSON && <Code className='max-h-[480px] overflow-y-auto'>{JSON.stringify(contractInterface, null, 2)}</Code>}
		</Box>
	</CardContainer>);
}

function SourceFile({ contracts, contract, path }: { contracts: ExplorerContractsSDK, contract: string, path: string }) {
	const { data, isLoading, error } = useQuery({
		queryKey: ['contract', contract, 'file', path],
		queryFn: () => contracts.verificationFile(contract, path)
	});
	if (isLoading) {
		return(<CardLoader />);
	}
	if (error || !data) {
		return(<Box><Muted>Cannot load {path}{error ? `: ${errorMessage(error)}` : ''}</Muted></Box>);
	}
	return(<Code className='max-h-[640px] overflow-y-auto rounded-none'>{data.text}</Code>);
}

function SourceFileRows({ contracts, contract, files, dir }: { contracts: ExplorerContractsSDK, contract: string, files: { path: string, size: number }[], dir?: string }) {
	const [open, setOpen] = useState<string | null>(null);
	return(<>
		{files.map(file => {
			const path = dir ? `${dir}/${file.path}` : file.path;
			return(<div key={path}>
				<button
					type='button'
					className='box p-4 gap-2 w-full text-left cursor-pointer hover:bg-slate-50'
					onClick={() => setOpen(open === path ? null : path)}
				>
					<Typography size="sm" weight='semibold' className='mr-auto [font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-functional-focused whitespace-normal break-all'>{file.path}</Typography>
					<Muted>{formatBytes(file.size)}</Muted>
				</button>
				{open === path && <SourceFile contracts={contracts} contract={contract} path={path} />}
			</div>);
		})}
	</>);
}

/** The contract's own source files */
function SourceFilesCard({ contracts, contract, files }: { contracts: ExplorerContractsSDK, contract: string, files: { path: string, size: number }[] }) {
	return(<CardContainer title={`Source files (${files.length})`} hasToggle>
		<SourceFileRows contracts={contracts} contract={contract} files={files} />
	</CardContainer>);
}

type ContractLibrary = { name: string, version: string, dir: string, sha256: string, files: { path: string, size: number }[] };

/**
 * The local packages the contract builds with besides its own, such as the
 * contract SDK: many contracts share them, so each is named by the hash of
 * its source, and its files are shown only when asked for
 */
function LibrariesCard({ contracts, contract, libraries }: { contracts: ExplorerContractsSDK, contract: string, libraries: ContractLibrary[] }) {
	const [open, setOpen] = useState<string | null>(null);
	return(<CardContainer title={`Libraries (${libraries.length})`} hasToggle>
		{libraries.map(library => (
			<div key={library.dir}>
				<button
					type='button'
					className='box p-4 gap-4 w-full text-left cursor-pointer hover:bg-slate-50'
					onClick={() => setOpen(open === library.dir ? null : library.dir)}
					title={`${library.dir} · source SHA-256 ${library.sha256}`}
				>
					<Typography size="sm" weight='semibold' className='[font-family:ui-monospace,SFMono-Regular,Menlo,monospace] text-functional-focused'>{library.name} {library.version}</Typography>
					<Muted className='mr-auto [font-family:ui-monospace,SFMono-Regular,Menlo,monospace]'>{library.sha256.slice(0, 12)}…</Muted>
					<Muted>{library.files.length} files · {formatBytes(library.files.reduce((total, file) => total + file.size, 0))}</Muted>
				</button>
				{open === library.dir && <SourceFileRows contracts={contracts} contract={contract} files={library.files} dir={library.dir} />}
			</div>
		))}
	</CardContainer>);
}

function StateCard({ contracts, contract }: { contracts: ExplorerContractsSDK, contract: string }) {
	const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
		queryKey: ['contract', contract, 'state'],
		queryFn: async ({ pageParam }: { pageParam?: string }) => await contracts.state(contract, pageParam ? { startAfter: pageParam } : {}),
		getNextPageParam: (page: Awaited<ReturnType<ExplorerContractsSDK['state']>>) => page.nextCursor ?? undefined
	});

	if (isLoading) {
		return(<CardContainer title="State accounts"><CardLoader /></CardContainer>);
	}
	if (error || !data) {
		return(<CardContainer title="State accounts"><Box><Muted>Cannot load the contract's state{error ? `: ${errorMessage(error)}` : ''}</Muted></Box></CardContainer>);
	}

	const states = data.pages.flatMap(page => page.states);
	const interfaceKnown = data.pages[0]?.interfaceKnown ?? false;

	return(<CardContainer title={`State accounts (${states.length}${hasNextPage ? '+' : ''})`}>
		{!interfaceKnown && states.length > 0 && <Box><Muted>Without a verified interface, state accounts are shown raw.</Muted></Box>}
		{states.length === 0 && <Box><Muted>This contract has no state accounts.</Muted></Box>}
		{states.map(state => (
			<div key={state.id} className='p-4 flex flex-col gap-2'>
				<div className='flex flex-wrap items-center justify-between gap-2'>
					<StateAccountKind account={state} />
					<div className={twMerge(textClass, 'flex items-center gap-3 text-slate-500')}>
						<span className='inline-flex items-center gap-1'>id <HexValue hex={state.id} chars={6} /></span>
						<span>version {state.version}</span>
						<span>{formatBytes(state.size)}</span>
					</div>
				</div>
				<StateAccountValue account={state} />
			</div>
		))}
		{hasNextPage && (
			<Box className='flex justify-center'>
				<Button variant='text' size='small' loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>Load more</Button>
			</Box>
		)}
	</CardContainer>);
}

function CallsCard({ contracts, contract }: { contracts: ExplorerContractsSDK, contract: string }) {
	const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
		queryKey: ['contract', contract, 'calls'],
		queryFn: async ({ pageParam }: { pageParam?: string }) => await contracts.calls(contract, pageParam ? { startBlock: pageParam } : {}),
		getNextPageParam: (page: Awaited<ReturnType<ExplorerContractsSDK['calls']>>) => page.nextCursor ?? undefined,
		refetchInterval: 15_000
	});

	if (isLoading) {
		return(<CardContainer title="Calls"><CardLoader /></CardContainer>);
	}
	if (error || !data) {
		return(<CardContainer title="Calls"><Box><Muted>Cannot load the contract's calls{error ? `: ${errorMessage(error)}` : ''}</Muted></Box></CardContainer>);
	}

	const calls = data.pages.flatMap(page => page.calls);
	const failed = calls.filter(call => call.outcome?.failure).length;
	return(<CardContainer title={`Calls (${calls.length}${hasNextPage ? '+' : ''}${failed > 0 ? `, ${failed} failed` : ''})`}>
		{calls.length === 0 && <Box><Muted>No calls yet.</Muted></Box>}
		<ContractCallList calls={calls} />
		{hasNextPage && (
			<Box className='flex justify-center'>
				<Button variant='text' size='small' loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>Load older calls</Button>
			</Box>
		)}
	</CardContainer>);
}

function ContractView({ contracts, contract }: { contracts: ExplorerContractsSDK, contract: string }) {
	const record = useQuery({
		queryKey: ['contract', contract, 'record'],
		queryFn: () => contracts.get(contract),
		retry: (count: number, error: unknown) => !(error instanceof ClientNotFoundError) && count < 2
	});
	const hasVerifier = record.data?.hasVerifier ?? false;
	const verification = useContractVerification(contracts, contract, hasVerifier);
	const codeInfo = useQuery({
		queryKey: ['contract', contract, 'code'],
		queryFn: () => contracts.codeInfo(contract),
		enabled: record.data !== undefined
	});
	const deployments = useQuery({
		queryKey: ['contract', contract, 'calls', 'first'],
		queryFn: () => contracts.calls(contract, { depth: '50' }),
		enabled: record.data !== undefined
	});

	/* Not a contract: nothing to show */
	if (record.error || (!record.isLoading && !record.data)) {
		return(null);
	}
	if (!record.data) {
		return(<CardContainer title="Contract"><CardLoader /></CardContainer>);
	}

	const { contract: details } = record.data;
	const deployment = deployments.data?.deployments.at(-1);
	const verified = verification.data?.verification && verification.data.matchesCode ? verification.data.verification : null;

	return(<>
		<ContentCard
			title="Contract"
			content={[
				{ label: 'Code hash', type: 'jsx', value: <CodeHash codeHash={details.codeHash} verification={hasVerifier ? verification.data : null} /> },
				{
					label: 'Code',
					type: 'jsx',
					value: <div className='flex items-center gap-3'>
						{codeInfo.isLoading && <LoaderCircular className='size-4' />}
						{codeInfo.data && <Typography size="sm">{formatBytes(codeInfo.data.code.size)}</Typography>}
						{codeInfo.error && <Typography size="sm" className='text-error'>Unavailable</Typography>}
						<a href={contracts.codeURL(contract)} download className='text-functional-focused'>
							<Typography size="sm" weight='semibold'>Download</Typography>
						</a>
					</div>
				},
				{ label: 'Admin', type: 'account', value: details.admin },
				{ label: 'Creator', type: 'account', value: details.creator },
				{ label: 'Sequencer', type: 'account', value: details.sequencer },
				{ label: 'Deployed', type: 'jsx', value: deployment ? <div className='flex items-center gap-2'><Muted>{completeDate(deployment.date)} in</Muted><TextBlockLink blockhash={deployment.block} truncateChars={6} /></div> : undefined }
			]}
		/>

		{hasVerifier && <VerificationCard contracts={contracts} contract={contract} query={verification} />}
		{verified?.interface && <InterfaceCard contractInterface={verified.interface} />}
		{verified && verified.files.length > 0 && <SourceFilesCard contracts={contracts} contract={contract} files={verified.files} />}
		{verified && verified.libraries.length > 0 && <LibrariesCard contracts={contracts} contract={contract} libraries={verified.libraries} />}

		<StateCard contracts={contracts} contract={contract} />
		<CallsCard contracts={contracts} contract={contract} />
	</>);
}

/**
 * A contract's record, verification, interface, source, state and calls,
 * when the account is a contract (contracts exist only on a local network,
 * in development; elsewhere this shows nothing)
 */
export function ContractSection({ publicKey }: { publicKey: string }) {
	const sdk = useClientSDK();
	const contracts = sdk.contracts;
	if (!contracts) {
		return(null);
	}
	return(<ContractView contracts={contracts} contract={publicKey} />);
}

/**
 * Whether an account is a contract, for labelling its page
 */
export function useIsContract(publicKey: string): boolean {
	const sdk = useClientSDK();
	const contracts = sdk.contracts;
	const { data } = useQuery({
		queryKey: ['contract', publicKey, 'record'],
		queryFn: () => contracts!.get(publicKey),
		enabled: contracts !== null,
		retry: (count: number, error: unknown) => !(error instanceof ClientNotFoundError) && count < 2
	});
	return(contracts !== null && data !== undefined);
}
