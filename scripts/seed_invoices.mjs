// Seeds the PayPal Sandbox with demo invoices for the vertical slice.
// Sandbox only. Run from the repo root.
//   node scripts/seed_invoices.mjs dry      shows the plan and calls nothing
//   node scripts/seed_invoices.mjs          creates, sends and records payments
// It stops if the account already has invoices, unless you add the word "again".

import { existsSync } from "node:fs";

// Load .env.local first so it wins over .env (loadEnvFile does not overwrite).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const dry = args.includes("dry");
const again = args.includes("again");

// Sandbox only. There is deliberately no switch for the live endpoint.
const BASE = "https://api-m.sandbox.paypal.com";

// issued and due are day offsets from today. A negative due means overdue.
const PLAN = [
  { email: "hackbuyer1@personal.example.com", given: "Maria", surname: "Brewster", segment: "Cafe", item: "Weekly coffee bean delivery", amount: "48.00", issued: -20, due: -10, paid: true },
  { email: "hackbuyer1@personal.example.com", given: "Maria", surname: "Brewster", segment: "Cafe", item: "Cold brew keg refill", amount: "64.50", issued: -25, due: -12, paid: false },
  { email: "hackbuyer2@personal.example.com", given: "Noah", surname: "Pixelworks", segment: "Design studio", item: "Brand refresh, milestone two", amount: "320.00", issued: -18, due: -4, paid: true },
  { email: "hackbuyer2@personal.example.com", given: "Noah", surname: "Pixelworks", segment: "Design studio", item: "Website banner set", amount: "150.00", issued: -22, due: -8, paid: false },
  { email: "hackbuyer3@personal.example.com", given: "Grace", surname: "Hopewell", segment: "Nonprofit", item: "Event flyer printing", amount: "75.00", issued: -3, due: 5, paid: false },
  { email: "hackbuyer4@personal.example.com", given: "Leo", surname: "Marquez", segment: "Freelancer", item: "Monthly bookkeeping", amount: "210.00", issued: -30, due: -15, paid: false },
  { email: "hackbuyer5@personal.example.com", given: "Priya", surname: "Shah", segment: "Retail", item: "Display shelving rental", amount: "128.00", issued: -10, due: 4, paid: true },
  { email: "hackbuyer6@personal.example.com", given: "Ethan", surname: "Walker", segment: "Repeat customer", item: "Subscription box, October", amount: "39.99", issued: -2, due: 12, paid: false },
];

function dateOffset(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

if (dry) {
  console.log("Dry run. Nothing will be called.\n");
  for (const [i, p] of PLAN.entries()) {
    const state = p.paid ? "paid" : p.due < 0 ? "unpaid, overdue" : "unpaid, not yet due";
    console.log(`${i + 1}. ${p.given} ${p.surname} (${p.segment}) USD ${p.amount} issued ${dateOffset(p.issued)} due ${dateOffset(p.due)} [${state}]`);
  }
  process.exit(0);
}

const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_SECRET;
if (!clientId || !secret) {
  console.error("Missing PAYPAL_CLIENT_ID or PAYPAL_SECRET in .env.local or .env");
  process.exit(1);
}

const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const token = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok) {
  console.error(`OAuth failed: HTTP ${tokenRes.status} ${token.error ?? ""}`);
  process.exit(1);
}

async function api(method, path, body, requestId) {
  const headers = { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" };
  if (requestId) headers["PayPal-Request-Id"] = requestId;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function describeError(r) {
  const d = r.data?.details?.[0];
  return `HTTP ${r.status} ${r.data?.name ?? ""} ${d?.issue ?? ""} ${d?.description ?? r.data?.message ?? ""}`.trim();
}

const existing = await api("GET", "/v2/invoicing/invoices?page=1&page_size=1&total_required=true");
if (!existing.ok) {
  console.error("Could not list invoices:", describeError(existing));
  process.exit(1);
}
if ((existing.data.total_items ?? 0) > 0 && !again) {
  console.log(`The account already has ${existing.data.total_items} invoice(s). Add the word "again" to seed anyway.`);
  process.exit(0);
}

let created = 0;
for (const [i, p] of PLAN.entries()) {
  const label = `${i + 1}. ${p.given} ${p.surname} USD ${p.amount}`;

  const num = await api("POST", "/v2/invoicing/generate-next-invoice-number", {});
  if (!num.ok) {
    console.log(`${label}: could not get an invoice number. ${describeError(num)}`);
    continue;
  }

  const draft = await api(
    "POST",
    "/v2/invoicing/invoices",
    {
      detail: {
        invoice_number: num.data.invoice_number,
        invoice_date: dateOffset(p.issued),
        currency_code: "USD",
        note: "Thank you for your business.",
        memo: `Segment: ${p.segment}`,
        reference: "HACKSEED",
        payment_term: { term_type: "DUE_ON_DATE_SPECIFIED", due_date: dateOffset(p.due) },
      },
      primary_recipients: [
        { billing_info: { name: { given_name: p.given, surname: p.surname }, email_address: p.email } },
      ],
      items: [
        {
          name: p.item,
          description: p.item,
          quantity: "1",
          unit_amount: { currency_code: "USD", value: p.amount },
        },
      ],
    },
    `seed_invoice_${i + 1}`
  );
  if (!draft.ok) {
    console.log(`${label}: create failed. ${describeError(draft)}`);
    continue;
  }
  const id = String(draft.data.href ?? "").split("/").pop();

  const sent = await api("POST", `/v2/invoicing/invoices/${id}/send`, { send_to_recipient: true, send_to_invoicer: false });
  if (!sent.ok) {
    console.log(`${label}: created as draft ${id} but send failed. ${describeError(sent)}`);
    continue;
  }

  if (p.paid) {
    const paid = await api("POST", `/v2/invoicing/invoices/${id}/payments`, {
      method: "OTHER",
      payment_date: dateOffset(p.issued + 1),
      amount: { currency_code: "USD", value: p.amount },
      note: "Seeded payment for the demo",
    });
    if (!paid.ok) {
      console.log(`${label}: sent ${id} but recording payment failed. ${describeError(paid)}`);
      continue;
    }
  }

  created += 1;
  console.log(`${label}: ok, invoice ${num.data.invoice_number} (${id})${p.paid ? ", marked paid" : ""}`);
}

console.log(`\nCreated ${created} of ${PLAN.length}. Current invoices in the sandbox:`);
const list = await api("GET", "/v2/invoicing/invoices?page=1&page_size=20&total_required=true");
if (list.ok) {
  for (const inv of list.data.items ?? []) {
    const who = inv.primary_recipients?.[0]?.billing_info?.name;
    console.log(
      `  ${inv.detail?.invoice_number}  ${who?.given_name ?? ""} ${who?.surname ?? ""}  USD ${inv.amount?.value}  ${inv.status}  due ${inv.detail?.payment_term?.due_date ?? ""}`
    );
  }
} else {
  console.log("Could not list invoices:", describeError(list));
}
