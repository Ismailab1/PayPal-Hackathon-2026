// Sandbox diagnostic for the spike.
// Prints HTTP status codes, record counts and the permissions your app was granted.
// It never prints your secret or your access token.
// Run from the repo root with: node scripts/check_sandbox.mjs

import { existsSync } from "node:fs";

// Load .env.local first so it wins over .env (loadEnvFile does not overwrite).
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

const clientId = process.env.PAYPAL_CLIENT_ID;
const secret = process.env.PAYPAL_SECRET;
if (!clientId || !secret) {
  console.error("Missing PAYPAL_CLIENT_ID or PAYPAL_SECRET in .env.local or .env");
  process.exit(1);
}

// Sandbox only. There is deliberately no switch for the live endpoint.
const BASE = "https://api-m.sandbox.paypal.com";

const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const token = await tokenRes.json().catch(() => ({}));
console.log(`OAuth token request: HTTP ${tokenRes.status}`);
if (!tokenRes.ok) {
  console.log("Error:", token.error ?? "", token.error_description ?? "");
  process.exit(1);
}

const scopes = String(token.scope ?? "").split(" ").filter(Boolean);
console.log(`\nPermissions granted to this app (${scopes.length}):`);
for (const s of scopes) console.log("  " + s.replace("https://uri.paypal.com/services/", ""));

const headers = { Authorization: `Bearer ${token.access_token}` };

async function probe(label, path, summarize) {
  const res = await fetch(BASE + path, { headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.log(`${label}: HTTP ${res.status} ${body.name ?? body.error ?? ""} ${body.message ?? body.error_description ?? ""}`);
    return;
  }
  console.log(`${label}: HTTP ${res.status}, ${summarize(body)}`);
}

console.log("\nData checks:");

await probe("Balances", "/v1/reporting/balances", (b) => {
  const list = b.balances ?? [];
  if (list.length === 0) return "0 balances returned";
  return list.map((x) => `${x.currency} total ${x.total_balance?.value}`).join("; ");
});

const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const end = new Date().toISOString();
await probe(
  "Transactions (30 days)",
  `/v1/reporting/transactions?start_date=${start}&end_date=${end}&fields=all&page_size=5`,
  (b) => `${(b.transaction_details ?? []).length} on first page, total_items ${b.total_items ?? 0}`
);

await probe(
  "Billing plans",
  "/v1/billing/plans?page_size=5&total_required=true",
  (b) => `${(b.plans ?? []).length} on first page, total_items ${b.total_items ?? 0}`
);

await probe(
  "Invoices",
  "/v2/invoicing/invoices?page=1&page_size=5&total_required=true",
  (b) => `${(b.items ?? []).length} on first page, total_items ${b.total_items ?? 0}`
);

console.log("\nDone. Nothing secret was printed.");
