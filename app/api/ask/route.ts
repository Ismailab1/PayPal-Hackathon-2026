import { NextResponse } from "next/server";
import { AskLimitError, MissingLlmKeyError, ask } from "@/lib/agent/ask";

// Turns a plain language question into live widgets and proposed reminders.
// Nothing is sent from here. Sending goes through the separate confirm route.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const question = typeof body?.question === "string" ? body.question : "";
  try {
    const result = await ask(question);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AskLimitError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    if (e instanceof MissingLlmKeyError) return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    // Keep provider details out of the browser. The full error stays on the server.
    console.error("ask failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "The assistant could not answer that right now. Please try again." }, { status: 500 });
  }
}
