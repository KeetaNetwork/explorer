import { ContentCard } from "@/components/ContentCard";
import { completeDate } from "@/helpers/date";
import { Button, Modal, ModalContent, ModalFooter, ModalHeader, useModal } from "@keetanetwork/web-ui";
import { IconBoolean } from "./IconBoolean";
import { toTitleCase } from "@/helpers/string";
import type { ExplorerClientSDK } from "@/libs/explorer-sdk";
import { CardContainer } from "@/components/CardContainer";

type ChainCertificateModalProps = {
	certificate: Awaited<ReturnType<typeof ExplorerClientSDK.prototype.account.certificate>>['certificate']['chain'][number];
};

export function ChainCertificateModal({ certificate }: ChainCertificateModalProps) {
	const { closeModal } = useModal();
	return (
		<Modal>
			<ModalHeader title={certificate.subjectName ?? "Certificate"} />

			<ModalContent className="space-y-5">
				<ContentCard
					title="Details"
					titleClassName="py-3 bg-slate-50"
					// contentClassName="border-t-0"
					content={[
						{ label: "Issuer", value: certificate.issuerName },
						{ label: "Subject", value: certificate.subjectName },
						{ label: "Is Root", value: certificate.isSelfSigned ? <IconBoolean value={true} /> : undefined, type: "jsx" },
						{ label: "Issued At", value: completeDate(certificate.issuedAt) },
						{ label: certificate.valid ? "Valid Until" : "Expired On", value: completeDate(certificate.expiresAt) },
						{ label: "Serial", value: `${certificate.serial.toString(16).toUpperCase()} (${certificate.serial.toString()})` },
						{ label: "Trusted", value: <IconBoolean value={certificate.trusted} />, type: "jsx" },
					]}
				/>

				<ContentCard
					title="Subject"
					titleClassName="py-3 bg-slate-50"
					content={certificate.subjectDN.map((item) => ({
						label: toTitleCase(item.name),
						value: item.value,
					}))}
				/>

				<ContentCard
					title="Issuer"
					titleClassName="py-3 bg-slate-50"
					content={certificate.issuerDN.map((item) => ({
						label: toTitleCase(item.name),
						value: item.value,
					}))}
				/>

				<ContentCard
					title="Attributes"
					titleClassName="py-3 bg-slate-50"
					content={certificate.attributes.map((item) => ({
						label: toTitleCase(item.name),
						value: item.sensitive ? "********" : item.value,
					}))}
				/>

				<CardContainer title="Certificate PEM" titleClassName="py-3 bg-slate-50" contentClassName="p-4 whitespace-pre font-mono text-sm overflow-x-auto">
					{certificate.pem}
				</CardContainer>
			</ModalContent>

			<ModalFooter
				left={<Button variant="tertiary" onClick={() => closeModal()}>Close</Button>}
			/>
		</Modal>
	)
}
