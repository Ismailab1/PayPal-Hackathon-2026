import type { InvoiceRow } from "../invoices";

export type Widget =
  | { kind: "stat"; title: string; value: string; caption: string }
  | { kind: "bar"; title: string; caption: string; bars: { label: string; value: number; display: string }[] }
  | { kind: "table"; title: string; caption: string; columns: string[]; rows: string[][] };

export type WidgetSpec = {
  kind: "table" | "bar" | "stat";
  title: string;
  metric: "amount_due" | "count";
  groupBy: "segment" | "customer" | "status" | "none";
  unpaidOnly: boolean;
  overdueOnly: boolean;
};

const MAX_TABLE_ROWS = 50;

// Work in whole cents so sums never pick up floating point noise.
const toCents = (value: string) => Math.round(parseFloat(value || "0") * 100) || 0;

function groupLabel(row: InvoiceRow, groupBy: WidgetSpec["groupBy"]): string {
  if (groupBy === "segment") return row.segment || "No segment";
  if (groupBy === "customer") return row.customer || "Unknown";
  if (groupBy === "status") return row.status;
  return "All";
}

// Builds a widget from live invoice rows. The model chooses the shape, this
// function does all of the arithmetic, so no number on screen comes from the model.
export function buildWidget(spec: WidgetSpec, all: InvoiceRow[]): Widget {
  let rows = all;
  const filters: string[] = [];
  if (spec.unpaidOnly) {
    rows = rows.filter((r) => r.canRemind);
    filters.push("unpaid only");
  }
  if (spec.overdueOnly) {
    rows = rows.filter((r) => r.overdue);
    filters.push("overdue only");
  }
  const currency = rows[0]?.currency ?? all[0]?.currency ?? "USD";
  const show = (n: number) => (spec.metric === "count" ? String(n) : `${currency} ${(n / 100).toFixed(2)}`);
  const valueOf = (r: InvoiceRow) => (spec.metric === "count" ? 1 : toCents(r.amountDue));
  const caption = `${rows.length} of ${all.length} live invoices${filters.length ? `, ${filters.join(", ")}` : ""}`;

  if (spec.kind === "stat") {
    return { kind: "stat", title: spec.title, value: show(rows.reduce((s, r) => s + valueOf(r), 0)), caption };
  }

  if (spec.kind === "bar") {
    const totals = new Map<string, number>();
    for (const r of rows) {
      const key = groupLabel(r, spec.groupBy);
      totals.set(key, (totals.get(key) ?? 0) + valueOf(r));
    }
    const bars = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, display: show(value) }));
    return { kind: "bar", title: spec.title, caption, bars };
  }

  if (spec.groupBy === "none") {
    return {
      kind: "table",
      title: spec.title,
      caption,
      columns: ["Invoice", "Customer", "Segment", "Amount due", "Status", "Due"],
      rows: rows
        .slice(0, MAX_TABLE_ROWS)
        .map((r) => [r.number, r.customer, r.segment, `${r.currency} ${r.amountDue}`, r.status, r.overdue ? `${r.dueDate} overdue` : r.dueDate]),
    };
  }

  const groups = new Map<string, { count: number; cents: number }>();
  for (const r of rows) {
    const key = groupLabel(r, spec.groupBy);
    const g = groups.get(key) ?? { count: 0, cents: 0 };
    g.count += 1;
    g.cents += toCents(r.amountDue);
    groups.set(key, g);
  }
  return {
    kind: "table",
    title: spec.title,
    caption,
    columns: ["Group", "Invoices", "Amount due"],
    rows: [...groups.entries()]
      .sort((a, b) => b[1].cents - a[1].cents)
      .slice(0, MAX_TABLE_ROWS)
      .map(([label, g]) => [label, String(g.count), `${currency} ${(g.cents / 100).toFixed(2)}`]),
  };
}
