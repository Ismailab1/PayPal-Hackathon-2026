"use client";

import { useState } from "react";
import ReminderButton from "@/components/ReminderButton";
import WidgetView from "@/components/WidgetView";
import type { Proposal } from "@/lib/agent/run";
import type { Widget } from "@/lib/agent/widgets";

type Answer = { answer: string; widgets: Widget[]; proposals: Proposal[] };

const EXAMPLES = [
  "Which customers are overdue and how much do they owe?",
  "Show unpaid amounts by customer segment",
  "Suggest friendly nudges for the overdue invoices",
];

export default function AskPanel() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Answer | null>(null);

  async function submit(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      if (data.ok) setResult({ answer: data.answer, widgets: data.widgets, proposals: data.proposals });
      else setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="Ask about your invoices"
          aria-label="Your question"
          className="flex-1 rounded border border-gray-400 p-2"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? "Thinking..." : "Ask"}
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={busy}
            onClick={() => {
              setQuestion(ex);
              void submit(ex);
            }}
            className="rounded-full border border-gray-400 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}

      {result && (
        <div className="space-y-4">
          {result.answer && <p>{result.answer}</p>}
          {result.widgets.map((w, i) => (
            <WidgetView key={i} widget={w} />
          ))}
          {result.proposals.length > 0 && (
            <section className="rounded border border-gray-300 p-4">
              <h2 className="text-lg font-semibold">Suggested reminders</h2>
              <p className="mb-3 text-sm text-gray-600">
                The assistant can only suggest. Nothing is sent until you review the message and confirm.
              </p>
              <ul className="space-y-3">
                {result.proposals.map((p) => (
                  <li key={p.invoiceId} className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                    <div>
                      <p className="font-medium">
                        {p.customer}, invoice {p.invoiceNumber}
                      </p>
                      <p className="text-sm text-gray-600">
                        {p.currency} {p.amountDue}, due {p.dueDate}
                        {p.overdue ? " (overdue)" : ""}
                      </p>
                      <p className="text-sm text-gray-600">{p.reason}</p>
                    </div>
                    <ReminderButton
                      id={p.invoiceId}
                      number={p.invoiceNumber}
                      given={p.given}
                      customer={p.customer}
                      amountDue={p.amountDue}
                      currency={p.currency}
                      dueDate={p.dueDate}
                      overdue={p.overdue}
                      initialNote={p.note}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
