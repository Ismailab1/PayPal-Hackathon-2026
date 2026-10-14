import { z } from "zod";

// Allowlist of actions the agent may take. Anything not listed is refused.
export enum AgentAction {
  ListTransactions = "list_transactions",
  ListInvoices = "list_invoices",
  GetBalances = "get_balances",
  BuildWidget = "build_widget",
  ProposeInvoiceReminder = "propose_invoice_reminder",
  SendInvoiceReminder = "send_invoice_reminder",
}

// The fixed choices a widget request can make. The model picks from these
// lists, the numbers themselves are always computed by our code.
export const WIDGET_KINDS = ["table", "bar", "stat"] as const;
export const WIDGET_METRICS = ["amount_due", "count"] as const;
export const WIDGET_GROUPS = ["segment", "customer", "status", "none"] as const;

// PayPal invoice ids start with INV2 and are placed in a URL path,
// so whitespace and URL delimiters are not allowed.
export const invoiceIdSchema = z.string().regex(/^INV2[^\s/?#]{4,40}$/);

// Input schema per action. Strict objects reject any key that is not declared,
// so an agent cannot smuggle in extra fields such as other recipients.
export const actionSchemas = {
  [AgentAction.ListTransactions]: z.strictObject({}),
  [AgentAction.ListInvoices]: z.strictObject({}),
  [AgentAction.GetBalances]: z.strictObject({}),
  [AgentAction.BuildWidget]: z.strictObject({
    kind: z.enum(WIDGET_KINDS),
    title: z.string().min(1).max(80),
    metric: z.enum(WIDGET_METRICS),
    groupBy: z.enum(WIDGET_GROUPS),
    unpaidOnly: z.boolean(),
    overdueOnly: z.boolean(),
  }),
  // Proposing changes nothing. It only prepares a reminder for a human to review.
  [AgentAction.ProposeInvoiceReminder]: z.strictObject({
    invoiceId: invoiceIdSchema,
    reason: z.string().max(200),
    note: z.string().max(300),
  }),
  [AgentAction.SendInvoiceReminder]: z.strictObject({
    invoiceId: invoiceIdSchema,
    note: z.string().max(300).optional(),
  }),
} as const;

// Only gated actions need the user to confirm first.
export const requiresConfirmation: Record<AgentAction, boolean> = {
  [AgentAction.ListTransactions]: false,
  [AgentAction.ListInvoices]: false,
  [AgentAction.GetBalances]: false,
  [AgentAction.BuildWidget]: false,
  [AgentAction.ProposeInvoiceReminder]: false,
  [AgentAction.SendInvoiceReminder]: true,
};

// The executor that applies validation, confirmation, limits and the audit
// log lives in run.ts. Always call actions through runAction.
