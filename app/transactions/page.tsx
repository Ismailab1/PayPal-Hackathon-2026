import { Suspense } from "react";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import Page from "@/components/Page";
import { load } from "@/lib/load";
import { getRecentTransactions } from "@/lib/paypal";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Page title="Recent transactions (last 30 days)">Loading...</Page>}>
      <TransactionsData />
    </Suspense>
  );
}

// Opt into per-request rendering so data is live, not built at build time.
async function TransactionsData() {
  await connection();
  const { rows, error } = await load(getRecentTransactions);
  if (error !== undefined) return <Page title="Recent transactions (last 30 days)" error={error} />;
  return (
    <Page title="Recent transactions (last 30 days)">
      <DataTable
        rows={rows}
        columns={[
          { header: "ID", render: (r) => r.transactionInfo?.transactionId },
          { header: "Date", render: (r) => r.transactionInfo?.transactionInitiationDate },
          { header: "Status", render: (r) => r.transactionInfo?.transactionStatus },
          {
            header: "Amount",
            render: (r) =>
              `${r.transactionInfo?.transactionAmount?.value ?? ""} ${r.transactionInfo?.transactionAmount?.currencyCode ?? ""}`,
          },
          { header: "Payer", render: (r) => r.payerInfo?.emailAddress },
        ]}
      />
    </Page>
  );
}
