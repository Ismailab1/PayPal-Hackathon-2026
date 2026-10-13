// In-memory audit log for agent actions (resets on server restart).
export type AuditEntry = {
  timestamp: string;
  action: string;
  inputs: unknown;
  confirmed: boolean;
  result: unknown;
};

const entries: AuditEntry[] = [];

// Record every agent action, whether it ran or not.
export function recordAudit(
  entry: Omit<AuditEntry, "timestamp">
): AuditEntry {
  const full = { timestamp: new Date().toISOString(), ...entry };
  entries.push(full);
  return full;
}

export function getAuditLog(): readonly AuditEntry[] {
  return entries;
}
