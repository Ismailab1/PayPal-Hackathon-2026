import { NextResponse } from "next/server";
import { AgentAction } from "@/lib/agent/tools";
import { runAction } from "@/lib/agent/run";

// Sends one invoice reminder. The body must carry confirmed: true, which the
// page only sends after the user has seen the message and clicked confirm.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await runAction(
      AgentAction.SendInvoiceReminder,
      { invoiceId: id, note: typeof body?.note === "string" ? body.note : undefined },
      { confirmed: body?.confirmed === true }
    );
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    const error = e instanceof Error ? e.message : "Could not send the reminder.";
    return NextResponse.json({ ok: false, error }, { status: 400 });
  }
}
