import { Suspense } from "react";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import Page from "@/components/Page";
import { load } from "@/lib/load";
import { getBalances } from "@/lib/paypal";

export default function BalancesPage() {
  return (
    <Suspense fallback={<Page title="Balances">Loading...</Page>}>
      <BalancesData />
    </Suspense>
  );
}

// Opt into per-request rendering so data is live, not built at build time.
async function BalancesData() {
  await connection();
  const { rows, error } = await load(getBalances);
  if (error !== undefined) return <Page title="Balances" error={error} />;
  return (
    <Page title="Balances">
      <DataTable
        rows={rows}
        columns={[
          { header: "Currency", render: (r) => r.currency },
          { header: "Total", render: (r) => r.totalBalance.value },
          { header: "Available", render: (r) => r.availableBalance?.value },
          { header: "Withheld", render: (r) => r.withheldBalance?.value },
        ]}
      />
    </Page>
  );
}
