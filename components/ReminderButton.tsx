"use client";

import { useState } from "react";
import { defaultReminderNote } from "@/lib/reminder_text";

type Props = {
  id: string;
  number: string;
  given: string;
  customer: string;
  amountDue: string;
  currency: string;
  dueDate: string;
  overdue: boolean;
  initialNote?: string;
};

// Two step control. Step one shows exactly what will be sent. Nothing leaves
// until the user clicks Confirm and send.
export default function ReminderButton(p: Props) {
  const [step, setStep] = useState<"idle" | "preview" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [note, setNote] = useState(() =>
    p.initialNote ??
    defaultReminderNote({
      given: p.given,
      number: p.number,
      amount: p.amountDue,
      currency: p.currency,
      dueDate: p.dueDate,
      overdue: p.overdue,
    })
  );

  async function confirmAndSend() {
    setStep("sending");
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(p.id)}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, note }),
      });
      const data = await res.json();
      if (data.ok) {
        setStep("done");
        setMessage(`Reminder sent to ${data.result.to}`);
      } else {
        setStep("error");
        setMessage(data.error ?? "Could not send the reminder.");
      }
    } catch {
      setStep("error");
      setMessage("Network error. Nothing was sent.");
    }
  }

  if (step === "done") return <span className="text-green-700">{message}</span>;

  if (step === "idle" || step === "error") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setStep("preview")}
          className="rounded border border-blue-600 px-2 py-1 text-blue-700 hover:bg-blue-50"
        >
          Send reminder
        </button>
        {step === "error" && <p className="mt-1 text-red-700">{message}</p>}
      </div>
    );
  }

  return (
    <div className="w-72 rounded border border-gray-300 p-2">
      <p className="mb-1 font-semibold">
        Remind {p.customer} about invoice {p.number}
      </p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        rows={5}
        disabled={step === "sending"}
        className="w-full rounded border border-gray-300 p-1 text-sm"
      />
      <p className="mb-2 text-xs text-gray-500">{note.length} of 300 characters. Sent to the invoice recipient only.</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={confirmAndSend}
          disabled={step === "sending" || note.trim().length === 0}
          className="rounded bg-blue-700 px-2 py-1 text-white disabled:opacity-50"
        >
          {step === "sending" ? "Sending..." : "Confirm and send"}
        </button>
        <button
          type="button"
          onClick={() => setStep("idle")}
          disabled={step === "sending"}
          className="rounded border border-gray-400 px-2 py-1"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
