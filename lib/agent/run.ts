import { getBalances, getRecentTransactions } from "../paypal";
import { getInvoice, listInvoices, sendInvoiceReminder } from "../invoices";
import { getAuditLog, recordAudit } from "../audit";
import { defaultReminderNote } from "../reminder_text";
import { AgentAction, actionSchemas } from "./tools";
import { requireConfirmation } from "./confirm";
import { buildWidget, type WidgetSpec } from "./widgets";

// Explicit limits for the one action that sends a message.
export const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const MAX_REMINDERS_PER_HOUR = 5;

// A business rule said no. The message is safe to show to the user.
export class ActionRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionRefused";
  }
}

export type Proposal = {
  invoiceId: string;
  invoiceNumber: string;
  customer: string;
  given: string;
  amountDue: string;
  currency: string;
  dueDate: string;
  overdue: boolean;
  reason: string;
  note: string;
};

type AuditResult = { ok?: boolean } | undefined;

// Notes written by a model must not carry links, which is the usual way an
// injected instruction would try to send a customer somewhere else.
const LINK_PATTERN = /https?:|www\.|\w+\.(com|net|org|io|co|app|xyz)\b/i;

// Strip control characters and tidy whitespace.
const clean = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, " ").trim();

// Successful, confirmed reminders already recorded in the audit log.
function sentReminders() {
  return getAuditLog().filter(
    (e) =>
      e.action === AgentAction.SendInvoiceReminder &&
      e.confirmed &&
      (e.result as AuditResult)?.ok === true
  );
}

async function remind(input: { invoiceId: string; note?: string }) {
  const invoice = await getInvoice(input.invoiceId);

  if (!invoice.canRemind) {
    throw new ActionRefused(
      `Invoice ${invoice.number} has status ${invoice.status}. Reminders are only sent for unpaid invoices.`
    );
  }

  const now = Date.now();
  const sent = sentReminders();

  const recentForInvoice = sent.some(
    (e) =>
      (e.inputs as { invoiceId?: string })?.invoiceId === input.invoiceId &&
      now - Date.parse(e.timestamp) < REMINDER_COOLDOWN_MS
  );
  if (recentForInvoice) {
    throw new ActionRefused(`A reminder for invoice ${invoice.number} was already sent in the last 24 hours.`);
  }

  const lastHour = sent.filter((e) => now - Date.parse(e.timestamp) < 60 * 60 * 1000).length;
  if (lastHour >= MAX_REMINDERS_PER_HOUR) {
    throw new ActionRefused(`The limit of ${MAX_REMINDERS_PER_HOUR} reminders per hour has been reached.`);
  }

  const subject = `Friendly reminder about invoice ${invoice.number}`;
  const note =
    (input.note ? clean(input.note) : "") ||
    defaultReminderNote({
      given: invoice.given,
      number: invoice.number,
      amount: invoice.amountDue,
      currency: invoice.currency,
      dueDate: invoice.dueDate,
      overdue: invoice.overdue,
    });

  await sendInvoiceReminder(input.invoiceId, subject, note);
  return { ok: true, invoiceId: input.invoiceId, invoiceNumber: invoice.number, to: invoice.email, subject, note };
}

// Prepares a reminder for a human to review. Changes nothing in PayPal.
async function propose(input: { invoiceId: string; reason: string; note: string }): Promise<Proposal> {
  const invoice = await getInvoice(input.invoiceId);
  if (!invoice.canRemind) {
    throw new ActionRefused(
      `Invoice ${invoice.number} has status ${invoice.status}, so a reminder cannot be proposed for it.`
    );
  }
  const note = clean(input.note);
  if (LINK_PATTERN.test(note)) {
    throw new ActionRefused("Suggested reminder notes may not contain links or web addresses.");
  }
  return {
    invoiceId: input.invoiceId,
    invoiceNumber: invoice.number,
    customer: invoice.customer,
    given: invoice.given,
    amountDue: invoice.amountDue,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    overdue: invoice.overdue,
    reason: clean(input.reason),
    note:
      note ||
      defaultReminderNote({
        given: invoice.given,
        number: invoice.number,
        amount: invoice.amountDue,
        currency: invoice.currency,
        dueDate: invoice.dueDate,
        overdue: invoice.overdue,
      }),
  };
}

// What goes in the audit log: small summaries, not whole result sets.
function summarize(action: AgentAction, result: unknown): unknown {
  if (Array.isArray(result)) return { ok: true, count: result.length };
  if (action === AgentAction.BuildWidget) {
    const w = result as { kind: string; title: string };
    return { ok: true, kind: w.kind, title: w.title };
  }
  if (action === AgentAction.ProposeInvoiceReminder) {
    const p = result as Proposal;
    return { ok: true, proposed: true, invoiceId: p.invoiceId, invoiceNumber: p.invoiceNumber };
  }
  return result;
}

// The single entry point for agent actions. Order matters:
// 1. the action must be in the allowlist, 2. inputs must match its strict schema,
// 3. gated actions need explicit confirmation, 4. business limits are checked,
// 5. the outcome, good or bad, is written to the audit log.
export async function runAction(
  action: AgentAction,
  inputs: unknown,
  options: { confirmed?: boolean } = {}
): Promise<unknown> {
  const confirmed = options.confirmed === true;
  try {
    if (!Object.values(AgentAction).includes(action)) {
      throw new ActionRefused(`Action "${String(action)}" is not on the allowlist.`);
    }
    const parsed = actionSchemas[action].parse(inputs);
    requireConfirmation(action, confirmed);

    let result: unknown;
    switch (action) {
      case AgentAction.ListTransactions:
        result = await getRecentTransactions();
        break;
      case AgentAction.ListInvoices:
        result = await listInvoices();
        break;
      case AgentAction.GetBalances:
        result = await getBalances();
        break;
      case AgentAction.BuildWidget:
        result = buildWidget(parsed as WidgetSpec, await listInvoices());
        break;
      case AgentAction.ProposeInvoiceReminder:
        result = await propose(parsed as { invoiceId: string; reason: string; note: string });
        break;
      case AgentAction.SendInvoiceReminder:
        result = await remind(parsed as { invoiceId: string; note?: string });
        break;
    }
    recordAudit({ action, inputs: parsed, confirmed, result: summarize(action, result) });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Action failed.";
    recordAudit({ action: String(action), inputs, confirmed, result: { ok: false, error: message } });
    throw e;
  }
}
