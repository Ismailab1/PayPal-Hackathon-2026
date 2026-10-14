import { paypalRest } from "./paypal_rest";

// Statuses PayPal reports once an invoice is settled. MARKED_AS_PAID is what a
// payment recorded outside PayPal looks like, so both count as paid.
export const PAID_STATUSES = new Set(["PAID", "MARKED_AS_PAID"]);

// Only these statuses may receive a reminder. PayPal has no overdue status,
// overdue is worked out from the due date below.
export const REMINDABLE_STATUSES = new Set(["SENT", "UNPAID", "PARTIALLY_PAID"]);

type RawInvoice = {
  id?: string;
  status?: string;
  detail?: {
    invoice_number?: string;
    memo?: string;
    currency_code?: string;
    payment_term?: { due_date?: string };
  };
  primary_recipients?: {
    billing_info?: {
      name?: { given_name?: string; surname?: string };
      email_address?: string;
    };
  }[];
  amount?: { value?: string; currency_code?: string };
  due_amount?: { value?: string; currency_code?: string };
};

export type InvoiceRow = {
  id: string;
  number: string;
  given: string;
  customer: string;
  email: string;
  segment: string;
  amount: string;
  amountDue: string;
  currency: string;
  status: string;
  dueDate: string;
  paid: boolean;
  overdue: boolean;
  canRemind: boolean;
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

// The memo is free text anyone can write, so only a short first clause is used as a label.
export function segmentFromMemo(memo: string): string {
  const first = memo.replace(/^Segment:\s*/i, "").split(/[.\n;]/)[0] ?? "";
  return first.trim().slice(0, 40);
}

export function toRow(inv: RawInvoice): InvoiceRow {
  const billing = inv.primary_recipients?.[0]?.billing_info;
  const given = billing?.name?.given_name ?? "";
  const surname = billing?.name?.surname ?? "";
  const email = billing?.email_address ?? "";
  const status = inv.status ?? "UNKNOWN";
  const dueDate = inv.detail?.payment_term?.due_date ?? "";
  const canRemind = REMINDABLE_STATUSES.has(status);
  const amount = inv.amount?.value ?? "";
  return {
    id: inv.id ?? "",
    number: inv.detail?.invoice_number ?? "",
    given,
    customer: `${given} ${surname}`.trim() || email,
    email,
    segment: segmentFromMemo(inv.detail?.memo ?? ""),
    amount,
    amountDue: inv.due_amount?.value ?? amount,
    currency: inv.amount?.currency_code ?? inv.detail?.currency_code ?? "USD",
    status,
    dueDate,
    paid: PAID_STATUSES.has(status),
    overdue: canRemind && dueDate !== "" && dueDate < todayUtc(),
    canRemind,
  };
}

// Overdue invoices first, then by due date.
export async function listInvoices(): Promise<InvoiceRow[]> {
  const data = await paypalRest<{ items?: RawInvoice[] }>(
    "GET",
    "/v2/invoicing/invoices?page=1&page_size=50&total_required=true"
  );
  return (data.items ?? [])
    .map(toRow)
    .sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.dueDate.localeCompare(b.dueDate));
}

export async function getInvoice(id: string): Promise<InvoiceRow> {
  const raw = await paypalRest<RawInvoice>("GET", `/v2/invoicing/invoices/${encodeURIComponent(id)}`);
  return toRow({ ...raw, id: raw.id ?? id });
}

// Sends the reminder to the invoice's own recipient only. There is deliberately
// no way to add other recipients through this function.
export async function sendInvoiceReminder(id: string, subject: string, note: string): Promise<void> {
  await paypalRest<void>("POST", `/v2/invoicing/invoices/${encodeURIComponent(id)}/remind`, {
    subject,
    note,
    send_to_invoicer: false,
  });
}
