import { Suspense } from "react";
import { connection } from "next/server";
import DataTable from "@/components/DataTable";
import Page from "@/components/Page";
import { getAuditLog } from "@/lib/audit";

export default function AuditPage() {
  return (
    <Suspense fallback={<Page title="Audit log">Loading...</Page>}>
      <AuditData />
    </Suspense>
  );
}

async function AuditData() {
  await connection();
  // Newest first.
  const rows = [...getAuditLog()].reverse();
  return (
    <Page title="Audit log">
      <p className="mb-3 text-sm text-gray-600">
        Every agent action is recorded here, including refused ones. The log is kept in memory and resets when the server restarts.
      </p>
      <DataTable
        rows={rows}
        columns={[
          { header: "Time", render: (r) => r.timestamp },
          { header: "Action", render: (r) => r.action },
          { header: "Confirmed", render: (r) => (r.confirmed ? "yes" : "no") },
          { header: "Inputs", render: (r) => JSON.stringify(r.inputs) },
          { header: "Result", render: (r) => JSON.stringify(r.result).slice(0, 200) },
        ]}
      />
    </Page>
  );
}
