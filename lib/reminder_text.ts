// Pure text helper, safe to import from both server and client code.
export function defaultReminderNote(p: {
  given: string;
  number: string;
  amount: string;
  currency: string;
  dueDate: string;
  overdue: boolean;
}): string {
  const greeting = p.given ? `Hi ${p.given}, a` : "A";
  const timing = p.overdue ? `was due on ${p.dueDate}` : `is due on ${p.dueDate}`;
  return `${greeting} friendly reminder that invoice ${p.number} for ${p.currency} ${p.amount} ${timing}. If you have already paid, thank you and please ignore this note.`;
}
