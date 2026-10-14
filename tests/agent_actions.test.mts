// Run with: npx tsx tests/agent_actions.test.mts
// Uses a fake PayPal, so it needs no credentials and makes no network calls.
import { strict as assert } from "node:assert";
import type { AgentAction as AgentActionType } from "../lib/agent/tools";

// Fake credentials and a fake PayPal. No network is used.
process.env.PAYPAL_CLIENT_ID = "test_id";
process.env.PAYPAL_SECRET = "test_secret";

type Call = { method: string; url: string; body?: Record<string, unknown> };
const calls: Call[] = [];

function raw(id: string, number: string, status: string, due: string) {
  return {
    id,
    status,
    detail: { invoice_number: number, memo: "Segment: Cafe", currency_code: "USD", payment_term: { due_date: due } },
    primary_recipients: [{ billing_info: { name: { given_name: "Maria", surname: "Brewster" }, email_address: "hackbuyer1@personal.example.com" } }],
    amount: { currency_code: "USD", value: "64.50" },
  };
}

const db: Record<string, ReturnType<typeof raw>> = {};
const idFor = (n: number) => `INV2-0000-0000-0000-000${n}`;
for (let n = 1; n <= 8; n++) db[idFor(n)] = raw(idFor(n), `000${n}`, "SENT", "2026-10-01");
db["INV2-PAID-PAID-PAID-0001"] = raw("INV2-PAID-PAID-PAID-0001", "0099", "MARKED_AS_PAID", "2026-10-01");
db["INV2-FUTU-RE00-0000-0001"] = raw("INV2-FUTU-RE00-0000-0001", "0098", "SENT", "2099-01-01");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  const method = init?.method ?? "GET";
  let body: Record<string, unknown> | undefined;
  try {
    body = init?.body ? JSON.parse(String(init.body)) : undefined;
  } catch {
    body = undefined; // the sign in request is form encoded, not JSON
  }
  calls.push({ method, url, body });
  if (url.endsWith("/v1/oauth2/token")) return json(200, { access_token: "tok", expires_in: 32000 });
  if (url.includes("/v2/invoicing/invoices?")) return json(200, { items: Object.values(db) });
  const m = url.match(/\/v2\/invoicing\/invoices\/([^/?]+)(\/remind)?$/);
  if (m && method === "GET") return db[m[1]] ? json(200, db[m[1]]) : json(404, { name: "RESOURCE_NOT_FOUND", message: "missing" });
  if (m && m[2] && method === "POST") return new Response(null, { status: 204 });
  return json(500, { name: "UNEXPECTED", message: url });
}) as typeof fetch;

const { AgentAction } = await import("../lib/agent/tools");
const { runAction, ActionRefused } = await import("../lib/agent/run");
const { getAuditLog } = await import("../lib/audit");

let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log("PASS", name);
  } catch (e) {
    console.log("FAIL", name, ":", e instanceof Error ? e.message : e);
    process.exitCode = 1;
  }
}
const remindCalls = () => calls.filter((c) => c.url.endsWith("/remind"));
const send = (id: string, confirmed?: boolean, extra: Record<string, unknown> = {}) =>
  runAction(AgentAction.SendInvoiceReminder, { invoiceId: id, ...extra }, { confirmed });

await check("unconfirmed reminder is refused and never reaches PayPal", async () => {
  await assert.rejects(send(idFor(1)), /confirmation/);
  assert.equal(calls.length, 0);
});

await check("unknown action is refused", async () => {
  await assert.rejects(runAction("create_refund" as unknown as AgentActionType, {}, { confirmed: true }), /allowlist/);
  assert.equal(calls.length, 0);
});

await check("extra keys such as another recipient are rejected by the strict schema", async () => {
  await assert.rejects(send(idFor(1), true, { recipient: "attacker@example.com" }));
  assert.equal(remindCalls().length, 0);
});

await check("malformed invoice id is rejected", async () => {
  await assert.rejects(send("../../payments/refund", true));
  await assert.rejects(send("INV2 with spaces", true));
  assert.equal(remindCalls().length, 0);
});

await check("note over 300 characters is rejected", async () => {
  await assert.rejects(send(idFor(1), true, { note: "x".repeat(301) }));
  assert.equal(remindCalls().length, 0);
});

await check("paid invoice is refused", async () => {
  await assert.rejects(send("INV2-PAID-PAID-PAID-0001", true), (e) => e instanceof ActionRefused && /unpaid/.test(e.message));
  assert.equal(remindCalls().length, 0);
});

await check("confirmed reminder sends once with a safe request body", async () => {
  const r = (await send(idFor(1), true)) as { ok: boolean; to: string; note: string };
  assert.equal(r.ok, true);
  const sent = remindCalls();
  assert.equal(sent.length, 1);
  assert.ok(sent[0].url.endsWith(`/v2/invoicing/invoices/${idFor(1)}/remind`));
  assert.equal(sent[0].body?.send_to_invoicer, false);
  assert.equal("additional_recipients" in (sent[0].body ?? {}), false);
  assert.match(String(sent[0].body?.note), /was due on 2026-10-01/);
  assert.match(String(sent[0].body?.subject), /0001/);
});

await check("same invoice cannot be reminded twice within 24 hours", async () => {
  const before = remindCalls().length;
  await assert.rejects(send(idFor(1), true), /last 24 hours/);
  assert.equal(remindCalls().length, before);
});

await check("a custom note is used, with control characters stripped", async () => {
  await send(idFor(2), true, { note: "Hello\nthere\u0007 friend" });
  const last = remindCalls().at(-1);
  assert.equal(last?.body?.note, "Hello there  friend");
});

await check("hourly cap of five reminders is enforced", async () => {
  await send(idFor(3), true);
  await send(idFor(4), true);
  await send(idFor(5), true);
  assert.equal(remindCalls().length, 5);
  await assert.rejects(send(idFor(6), true), /per hour/);
  assert.equal(remindCalls().length, 5);
});

await check("listing maps rows, computes overdue and parses the segment", async () => {
  const rows = (await runAction(AgentAction.ListInvoices, {})) as { number: string; overdue: boolean; paid: boolean; segment: string; canRemind: boolean }[];
  const paid = rows.find((r) => r.number === "0099");
  const future = rows.find((r) => r.number === "0098");
  const late = rows.find((r) => r.number === "0006");
  assert.equal(paid?.paid, true);
  assert.equal(paid?.canRemind, false);
  assert.equal(future?.overdue, false);
  assert.equal(late?.overdue, true);
  assert.equal(late?.segment, "Cafe");
  assert.equal(rows[0].overdue, true, "overdue rows sort first");
});

await check("extra keys on a read action are rejected", async () => {
  await assert.rejects(runAction(AgentAction.ListInvoices, { limit: 5 }));
});

await check("every call, allowed or refused, is in the audit log", async () => {
  const log = getAuditLog();
  const okSends = log.filter((e) => e.action === "send_invoice_reminder" && e.confirmed && (e.result as { ok?: boolean }).ok === true);
  const refused = log.filter((e) => (e.result as { ok?: boolean })?.ok === false);
  assert.equal(okSends.length, 5);
  assert.ok(refused.length >= 8, `expected at least 8 refused entries, got ${refused.length}`);
  assert.ok(log.some((e) => e.action === "list_invoices"));
  assert.ok(!JSON.stringify(log).includes("test_secret"), "secret must never appear in the log");
});

console.log(`\n${passed} checks passed${process.exitCode ? ", with failures" : ""}`);
