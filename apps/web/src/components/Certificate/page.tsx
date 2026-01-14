import NotFoundPage from "@/app/not-found";
import { ContentCard } from "@/components/ContentCard";
import { CopyButton } from "@/components/CopyButton";
import DEPRECATED_Typography from "@/components/core/Typography";
import PageContent from "@/components/layout/PageContent";
import { PageLoader } from "@/components/layout/PageLoader";
import { TableRowItem } from "@/components/Table";
import { TableCard } from "@/components/TableCard";
import { completeDate } from "@/helpers/date";
import { toTitleCase } from "@/helpers/string";
import { useClientSDK } from "@/providers/ClientProvider";
import { Icon, Tag, Typography, useModal } from "@keetanetwork/web-ui";
import { useQuery$ } from "@preact-signals/query";
import { Fragment } from "preact/jsx-runtime";
import { twMerge } from "tailwind-merge";
import { CertificatePemContent } from "./CertificatePemContent";
import { ChainCertificateModal } from "./ChainCertificateModal";
import { IconBoolean } from "./IconBoolean";

export default function CertificatePage({ params: { accountPublicKey, certificateHash } }: { params: { accountPublicKey: string, certificateHash: string }}) {
	const sdk = useClientSDK();
	const { data, isError, isLoading } = useQuery$(() => ({
		queryKey: ['account', accountPublicKey, 'certificate', certificateHash],
		queryFn: () => sdk.account.certificate(accountPublicKey, certificateHash),
	}))

	const { openModal } = useModal();

	if (isError) {
		return(<NotFoundPage />);
	}

	if (!data || isLoading) {
		return(<PageLoader />);
	}

	const { certificate } = data;

	return (
		<PageContent>
			<div className='flex flex-col gap-4 mb-4 md:mb-10 w-full text-white'>
				<div className='flex gap-2 items-center text-white opacity-50 md:opacity-100'>
					<Icon type="verified" className="size-4" />

					<DEPRECATED_Typography
						className="capitalize md:uppercase"
						variant="overline1"
					>
						Certificate
					</DEPRECATED_Typography>
				</div>

				<div className='flex flex-col gap-4 md:gap-1'>
					<div className='flex items-center gap-3'>
						<DEPRECATED_Typography
							variant='h6'
							className={twMerge(
								'text-white shrink max-w-[calc(100%-40px)] font-normal',
								'md:text-[18px] md:font-semibold'
							)}
						>
							{certificate.hash}
						</DEPRECATED_Typography>
						<CopyButton text={certificate.hash} iconSize={24} />
					</div>

					<div className={twMerge(
						'bg-white/5 px-5 py-3 rounded-xl flex flex-col gap-1',
						' md:flex-row md:items-center md:p-0 md:bg-white/0'
					)}>
						<DEPRECATED_Typography
							variant='body3'
							className={
								'text-white opacity-70 md:opacity-50 text-[12px] uppercase md:normal-case md:text-[16px]'
							}
						>
							{certificate.issuerName}
						</DEPRECATED_Typography>
					</div>
				</div>
			</div>

			<div className='flex flex-col gap-8'>
				<ContentCard
					title="Details"
					content={[
						{ label: "Account", value: certificate.subjectPublicKey, type: "account" },
						{ label: "Issued On", value: certificate.issuedAt, type: "datetime" },
						certificate.valid ? (
							{ label: "Valid Until", value: certificate.expiresAt, type: "datetime" }
						) : (
							{ label: "Expired On", value: <Typography size="sm" className="text-error">{completeDate(certificate.expiresAt)}</Typography>, type: "jsx" }
						),
						{ label: "Serial", value: `${certificate.serial.toString(16).toUpperCase()} (${certificate.serial.toString()})` },
						{ label: "Trusted", value: <IconBoolean value={certificate.trusted} />, type: "jsx" },
					]}
				/>

				<ContentCard
					title="Subject"
					content={certificate.subjectDN.map((item) => ({
						label: toTitleCase(item.name),
						value: item.value,
					}))}
				/>

				<ContentCard
					title="Issuer"
					content={certificate.issuerDN.map((item) => ({
						label: toTitleCase(item.name),
						value: item.value,
					}))}
				/>

				<ContentCard
					title="Attributes"
					content={certificate.attributes.map((item) => ({
						label: toTitleCase(item.name),
						value: item.sensitive ? "********" : item.value,
					}))}
				/>

				{/* Chain of Trust */}
				<TableCard
					title="Chain of Trust"
					rows={certificate.chain}
					columns={[
						{ title: "Trusted", size: 1 },
						{ title: "Issuer", size: 5 },
						{ title: "Subject", size: 5 },
						{ title: "", size: 1 },
					]}
					renderRow={row => (
						<Fragment key={row.hash}>
							<TableRowItem className='col-span-1 justify-center' position="first">
								<IconBoolean value={row.trusted} />
								{/* <Typography size="sm">
									{middleSubstring(row.hash, 4)}
								</Typography> */}
								{/* <TextCertificateLink hash={row.hash} account={row.subjectPublicKey} /> */}

							</TableRowItem>
							{row.isSelfSigned ? (
								<TableRowItem className='col-span-10'>
									<Typography size="sm">{row.issuerName}</Typography>
									<Tag text="ROOT" textClassName="text-[10px] tracking-[0.15em]" className="" />
								</TableRowItem>
							) : (
								<>
									<TableRowItem className='col-span-5'>
										<Typography size="sm">{row.issuerName}</Typography>
									</TableRowItem>
									<TableRowItem className='col-span-5'>
										<Typography size="sm">{row.subjectName}</Typography>
									</TableRowItem>
								</>
							)}
							<TableRowItem position="last">
								<a onClick={() => openModal(<ChainCertificateModal certificate={row} />)} className={"text-functional-focused"}><Typography weight="semibold" size="sm">View</Typography></a>
							</TableRowItem>
						</Fragment>
					)}
				/>

				{/* Certificate PEM Content */}
				<CertificatePemContent content={certificate.pem} />
			</div>
		</PageContent>
	)
}
