import { MissingCredentialsError } from "./paypal";

// Direct REST helper for PayPal APIs that the SDK does not cover (Invoicing).
// Sandbox only. The base URL is fixed on purpose, there is no switch for live.
const BASE = "https://api-m.sandbox.paypal.com";

export class PayPalRestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PayPalRestError";
    this.status = status;
  }
}

// Cache the access token in memory until shortly before it expires.
let cached: { token: string; expiresAt: number } | undefined;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  if (!clientId || !secret) throw new MissingCredentialsError();

  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;

  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${clientId}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    // Report PayPal's error name only. Never include credentials or tokens.
    throw new PayPalRestError(res.status, `PayPal sign in failed (HTTP ${res.status}) ${data.error ?? ""}`.trim());
  }
  cached = { token: data.access_token, expiresAt: Date.now() + Number(data.expires_in ?? 300) * 1000 };
  return cached.token;
}

export async function paypalRest<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.details?.[0];
    throw new PayPalRestError(
      res.status,
      `PayPal request failed (HTTP ${res.status}) ${data?.name ?? ""} ${detail?.issue ?? ""} ${detail?.description ?? data?.message ?? ""}`.trim()
    );
  }
  return data as T;
}
