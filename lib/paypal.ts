import {
  Client,
  Environment,
  TransactionSearchController,
  SubscriptionsController,
} from "@paypal/paypal-server-sdk";

// Thrown when the sandbox credentials are not set, so pages can show a clear message.
export class MissingCredentialsError extends Error {
  constructor() {
    super(
      "PayPal credentials are missing. Copy env.example to .env.local and set PAYPAL_CLIENT_ID and PAYPAL_SECRET (Sandbox app)."
    );
    this.name = "MissingCredentialsError";
  }
}

// Build the single PayPal client lazily so a missing .env doesn't break the build.
// The environment is hardcoded to Sandbox on purpose.
let client: Client | undefined;
function getClient(): Client {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new MissingCredentialsError();
  client ??= new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: secret,
    },
    environment: Environment.Sandbox,
  });
  return client;
}

// Transaction Search allows at most a 31 day range, and new activity
// can take up to 3 hours to appear.
export async function getRecentTransactions() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const { result } = await new TransactionSearchController(
    getClient()
  ).searchTransactions({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    fields: "all",
    pageSize: 20,
    page: 1,
  });
  return result.transactionDetails ?? [];
}

export async function getBillingPlans() {
  const { result } = await new SubscriptionsController(
    getClient()
  ).listBillingPlans({ pageSize: 20, page: 1 });
  return result.plans ?? [];
}

export async function getBalances() {
  const { result } = await new TransactionSearchController(
    getClient()
  ).searchBalances({});
  return result.balances ?? [];
}
