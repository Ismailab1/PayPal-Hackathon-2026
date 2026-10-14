// In memory audit log for agent actions (resets on server restart).
export type AuditEntry = {
  timestamp: string;
  action: string;
  inputs: unknown;
  confirmed: boolean;
  result: unknown;
};

// Keep the list on globalThis so pages and route handlers share one log,
// even when the dev server reloads modules.
const g = globalThis as typeof globalThis & { __auditEntries?: AuditEntry[] };
const entries: AuditEntry[] = (g.__auditEntries ??= []);

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
