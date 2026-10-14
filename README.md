# PayPal AI Dashboard

Ask a plain language question about your PayPal invoices and get a live chart or table. The AI can also draft friendly payment reminders, but it can never send one. A reminder goes out only after a person reviews the message and clicks Confirm and send.

Built for the PayPal AI Hackathon. Runs against the PayPal **Sandbox** only.

## What it does

1. You ask a question such as "Show unpaid amounts by customer segment".
2. Claude reads your live Sandbox invoices through a tool and requests a widget (stat, bar chart or table).
3. The app computes every figure in the widget from the live invoices. The model never supplies those numbers.
4. You can ask Claude to suggest reminders for overdue invoices. It returns drafts with a reason for each.
5. You review and edit a draft, then confirm. Only then does the app call the PayPal Invoicing reminder endpoint.
6. Every action, including refused ones, appears on the audit page.

## How PayPal is used

PayPal is central. All data and the one action come from the PayPal Sandbox.

| Use | PayPal API |
| --- | --- |
| Authentication | OAuth 2.0 client credentials, token cached until expiry |
| Read invoices | Invoicing v2, `GET /v2/invoicing/invoices` |
| Send a reminder | Invoicing v2, `POST /v2/invoicing/invoices/{id}/remind` |
| Seed demo data | Invoicing v2, create and send invoices (`scripts/seed_invoices.mjs`) |
| Other views | Transaction Search, billing plans and balances through `@paypal/paypal-server-sdk` |

The official SDK has no invoicing controller, so invoicing uses direct REST calls in `lib/paypal_rest.ts`. The base URL is fixed to the Sandbox. There is no switch to live.

## How AI is used

Claude (default model `claude-sonnet-5-5`, set `ANTHROPIC_MODEL` to change it) is called through the Anthropic API in `lib/agent/ask.ts`. It works in a short tool loop with `tool_choice` set to auto.

The model sees three tools only, defined in `lib/agent/model_tools.ts` with strict input schemas:

- `list_invoices`: read the live invoices
- `build_widget`: request a stat, bar chart or table from a fixed set of options
- `propose_invoice_reminder`: draft a reminder for review

There is no tool for sending. Sending exists only in the confirmed route used by the Confirm and send button.

## Safety design

Reliability comes from code, not from prompt wording.

- **Allowlist:** an enum of actions in `lib/agent/tools.ts`. Unknown actions are refused.
- **Strict inputs:** every action has a strict zod schema. Extra fields are rejected.
- **Confirmation:** `SendInvoiceReminder` requires `confirmed: true`, which only the user's button click sets. The model cannot set it.
- **Limits:** one reminder per invoice per 24 hours, 5 reminders per hour. Paid invoices are refused.
- **Recipient:** a reminder goes only to the invoice's own recipient. No extra recipients and no copy to the sender.
- **Untrusted data:** invoice fields are passed to the model inside an `untrusted_invoice_data` block. Email addresses are never shown to the model. A memo is cut to a short label of 40 characters. Notes drafted by the model may not contain links.
- **Bounds:** at most 6 model turns, 500 characters per question, 10 questions per minute.
- **Audit:** `lib/audit.ts` records timestamp, action, inputs, whether it was confirmed and the result. The log is kept in memory and resets when the server restarts.

## Run it locally

1. Install Node 20.9 or later (`.nvmrc` pins 22).
2. Run `npm ci`.
3. Copy `env.example` to `.env.local` and fill in your values (see below).
4. Optional: seed demo invoices with `node scripts/seed_invoices.mjs dry`, then `node scripts/seed_invoices.mjs`. The script sends to Sandbox personal accounts named hackbuyer1 to hackbuyer6, so create those first in the PayPal developer dashboard.
5. Run `npm run dev` and open http://localhost:3000/ask.

Other commands:

- `node scripts/check_sandbox.mjs` checks your credentials and prints counts, never secrets.
- `npx tsx tests/agent_actions.test.mts` runs 13 safety checks against a fake PayPal.
- `npx tsx tests/ask.test.mts` runs 12 checks of the AI step against a fake model and a fake PayPal.
- `npm run lint` and `npm run build`.

The tests need no credentials and make no network calls.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PAYPAL_CLIENT_ID` | Yes | Client ID of your PayPal **Sandbox** app |
| `PAYPAL_SECRET` | Yes | Secret of your PayPal **Sandbox** app |
| `LLM_API_KEY` | For `/ask` | Anthropic API key. Set a spending limit on it. |
| `ANTHROPIC_MODEL` | No | Overrides the default model |

**This project uses the PayPal Sandbox only. Never commit real credentials. `.env` files other than `env.example` are git ignored.**

## Pages

- `/ask`: the AI assistant
- `/invoices`: all invoices with a manual, confirmed reminder button
- `/audit`: the action log
- `/transactions`, `/subscriptions`, `/balances`: Sandbox data views

## Known limits

- The audit log and reminder cooldowns are in memory, so a restart resets them.
- Sandbox only. Customer segments come from a "Segment:" prefix in the invoice memo, written by the seed script.
- Transaction Search allows a 31 day range, and new activity can take up to 3 hours to appear.

## License

Apache License 2.0. See `LICENSE`.
