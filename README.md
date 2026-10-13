# PayPal AI Dashboard

A dashboard where you ask a natural language question about your PayPal Sandbox data and an AI agent answers. The agent can suggest one action, a friendly invoice reminder, which only runs after you confirm it.

> Status: starter scaffold. The AI agent and any AI provider are not implemented yet.

## How PayPal is used

Uses the official `@paypal/paypal-server-sdk` against the **Sandbox** environment only:

- `TransactionSearchController.searchTransactions` – recent transactions (last 30 days, up to 20, `fields=all`)
- `SubscriptionsController.listBillingPlans` – billing plans (up to 20)
- `TransactionSearchController.searchBalances` – account balances

Transaction Search allows at most a 31 day range, and new activity can take up to 3 hours to appear.

## How AI will be used

Later, an LLM will turn a user's question into calls to an allowlisted set of read actions, summarize the results, and may propose one gated action (send an invoice reminder) for the user to confirm.

## Local setup

1. Install Node 20.9 or later.
2. Copy `env.example` to `.env.local` and fill in your Sandbox credentials.
3. Run `npm install`.
4. Run `npm run dev` and open http://localhost:3000.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PAYPAL_CLIENT_ID` | Yes | Client ID of your PayPal **Sandbox** app |
| `PAYPAL_SECRET` | Yes | Secret of your PayPal **Sandbox** app |
| `LLM_API_KEY` | No | Placeholder for a future LLM provider key (unused) |

**⚠️ This project uses the PayPal Sandbox only. Never commit real credentials. `.env.local` and all other env files (except `env.example`) are git-ignored.**

## Safety design

- **Action allowlist:** `lib/agent/tools.ts` lists the only actions the agent can take (an enum plus input schemas). Anything else is refused.
- **Confirmation:** gated actions that send money or messages (e.g. invoice reminders) must pass `requireConfirmation` in `lib/agent/confirm.ts` first.
- **Audit log:** `lib/audit.ts` records every agent action with timestamp, action, inputs, whether it was confirmed, and the result (in memory for now).
