import { Suspense } from "react";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import Page from "@/components/Page";
import { load } from "@/lib/load";
import { getBillingPlans } from "@/lib/paypal";

export default function SubscriptionsPage() {
  return (
    <Suspense fallback={<Page title="Billing plans">Loading...</Page>}>
      <SubscriptionsData />
    </Suspense>
  );
}

// Opt into per-request rendering so data is live, not built at build time.
async function SubscriptionsData() {
  await connection();
  const { rows, error } = await load(getBillingPlans);
  if (error !== undefined) return <Page title="Billing plans" error={error} />;
  return (
    <Page title="Billing plans">
      <DataTable
        rows={rows}
        columns={[
          { header: "ID", render: (r) => r.id },
          { header: "Name", render: (r) => r.name },
          { header: "Status", render: (r) => r.status },
          { header: "Created", render: (r) => r.createTime },
        ]}
      />
    </Page>
  );
}
