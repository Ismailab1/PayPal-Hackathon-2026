import { Suspense } from "react";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import Page from "@/components/Page";
import ReminderButton from "@/components/ReminderButton";
import { load } from "@/lib/load";
import { listInvoices } from "@/lib/invoices";

export default function InvoicesPage() {
  return (
    <Suspense fallback={<Page title="Invoices">Loading...</Page>}>
      <InvoicesData />
    </Suspense>
  );
}

// Opt into per-request rendering so data is live, not built at build time.
async function InvoicesData() {
  await connection();
  const { rows, error } = await load(listInvoices);
  if (error !== undefined) return <Page title="Invoices" error={error} />;
  return (
    <Page title="Invoices">
      <p className="mb-3 text-sm text-gray-600">
        Reminders are only offered for unpaid invoices. Nothing is sent until you confirm.
      </p>
      <DataTable
        rows={rows}
        columns={[
          { header: "Invoice", render: (r) => r.number },
          { header: "Customer", render: (r) => r.customer },
          { header: "Segment", render: (r) => r.segment },
          { header: "Amount", render: (r) => `${r.currency} ${r.amount}` },
          { header: "Status", render: (r) => r.status },
          {
            header: "Due",
            render: (r) => (r.overdue ? <span className="font-semibold text-red-700">{r.dueDate} overdue</span> : r.dueDate),
          },
          {
            header: "Action",
            render: (r) =>
              r.canRemind && r.id ? (
                <ReminderButton
                  id={r.id}
                  number={r.number}
                  given={r.given}
                  customer={r.customer}
                  amountDue={r.amountDue}
                  currency={r.currency}
                  dueDate={r.dueDate}
                  overdue={r.overdue}
                />
              ) : null,
          },
        ]}
      />
    </Page>
  );
}
