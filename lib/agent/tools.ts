import { z } from "zod";

// Allowlist of actions the agent may take. Anything not listed is refused.
export enum AgentAction {
  ListTransactions = "list_transactions",
  ListInvoices = "list_invoices",
  GetBalances = "get_balances",
  SendInvoiceReminder = "send_invoice_reminder",
}

// Input schema per action.
export const actionSchemas = {
  [AgentAction.ListTransactions]: z.object({}),
  [AgentAction.ListInvoices]: z.object({}),
  [AgentAction.GetBalances]: z.object({}),
  [AgentAction.SendInvoiceReminder]: z.object({
    invoiceId: z.string(),
    note: z.string().optional(),
  }),
} as const;

// Only gated actions need the user to confirm first.
export const requiresConfirmation: Record<AgentAction, boolean> = {
  [AgentAction.ListTransactions]: false,
  [AgentAction.ListInvoices]: false,
  [AgentAction.GetBalances]: false,
  [AgentAction.SendInvoiceReminder]: true,
};

// TODO: implement each action (call lib/paypal.ts, validate with actionSchemas,
// call requireConfirmation for gated actions, and log with recordAudit).
export async function runAction(
  action: AgentAction,
  inputs: unknown
): Promise<unknown> {
  void action;
  void inputs;
  throw new Error("TODO: agent actions are not implemented yet.");
}
