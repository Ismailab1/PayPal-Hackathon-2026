// Cancels the first demo seed batch so the demo shows one clean set of invoices.
// Sandbox only. Run from the repo root.
//   node scripts/cleanup_invoices.mjs dry      lists what would be cancelled and calls nothing
//   node scripts/cleanup_invoices.mjs          cancels them
// Only invoices that carry the HACKSEED reference AND have a number from 0001 to 0008 are touched.
// Paid invoices cannot be cancelled and are skipped. Nobody is emailed.

import { existsSync } from "node:fs";

// Load .env.local first so it wins over .env (loadEnvFile does not overwrite).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const dry = process.argv.slice(2).includes("dry");
const FIRST = 1;
const LAST = 8;
const CANCELLABLE = new Set(["SENT", "UNPAID", "PARTIALLY_PAID"]);

// Sandbox only. There is deliberately no switch for the live endpoint.
const BASE = "https://api-m.sandbox.paypal.com";

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

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

function describeError(r) {
  const d = r.data?.details?.[0];
  return `HTTP ${r.status} ${r.data?.name ?? ""} ${d?.issue ?? ""} ${d?.description ?? r.data?.message ?? ""}`.trim();
}

const list = await api("GET", "/v2/invoicing/invoices?page=1&page_size=100&total_required=true");
if (!list.ok) {
  console.error("Could not list invoices:", describeError(list));
  process.exit(1);
}

const targets = (list.data.items ?? []).filter((inv) => {
  const n = Number.parseInt(inv.detail?.invoice_number ?? "", 10);
  return inv.detail?.reference === "HACKSEED" && n >= FIRST && n <= LAST;
});

console.log(dry ? "Dry run. Nothing will be called.\n" : "Cancelling:\n");
let cancelled = 0;
for (const inv of targets) {
  const who = inv.primary_recipients?.[0]?.billing_info?.name;
  const label = `${inv.detail.invoice_number}  ${who?.given_name ?? ""} ${who?.surname ?? ""}  USD ${inv.amount?.value}  ${inv.status}`;
  if (!CANCELLABLE.has(inv.status)) {
    console.log(`  skip    ${label}`);
    continue;
  }
  if (dry) {
    console.log(`  would cancel  ${label}`);
    continue;
  }
  const r = await api("POST", `/v2/invoicing/invoices/${inv.id}/cancel`, {
    send_to_invoicer: false,
    send_to_recipient: false,
  });
  if (r.ok) {
    cancelled += 1;
    console.log(`  cancelled  ${label}`);
  } else {
    console.log(`  failed  ${label}  ${describeError(r)}`);
  }
}

if (!dry) console.log(`\nCancelled ${cancelled}.`);
const after = await api("GET", "/v2/invoicing/invoices?page=1&page_size=100&total_required=true");
if (after.ok) {
  console.log("\nInvoices now:");
  for (const inv of after.data.items ?? []) {
    const who = inv.primary_recipients?.[0]?.billing_info?.name;
    console.log(`  ${inv.detail?.invoice_number}  ${who?.given_name ?? ""} ${who?.surname ?? ""}  USD ${inv.amount?.value}  ${inv.status}`);
  }
}
