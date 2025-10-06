import { useTransactions, type Operation } from "@/hooks/useTransactions";
import { PaginatedCard } from "../PaginatedCard";
import { TransactionsTable } from "./TransactionsTable";
import { TokenTransactionTable } from "./TokenTransactionTable";

interface TransactionsProps {
	publicKey?: string;
	title?: string;
	variant?: "default" | "token";
}

const mapVariantRender = {
	default: (rows: Operation[]) => <TransactionsTable operations={rows} />,
	token: (rows: Operation[]) => <TokenTransactionTable operations={rows} />,
}

export function Transactions({ publicKey, title = "Transactions History", variant = "default" }: TransactionsProps) {
	const transactions = useTransactions({ publicKey })

	return (
		<PaginatedCard title={title} {...transactions}>
			{(rows) => mapVariantRender[variant](rows)}
		</PaginatedCard>
	)
}
