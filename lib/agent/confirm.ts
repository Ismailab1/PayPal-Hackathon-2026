import { AgentAction, requiresConfirmation } from "./tools";

// Must be called before any gated action runs.
// TODO: wire this to a real UI confirmation step (e.g. a confirm button).
export function requireConfirmation(
  action: AgentAction,
  confirmed: boolean
): void {
  if (requiresConfirmation[action] && !confirmed) {
    throw new Error(`Action "${action}" needs user confirmation first.`);
  }
}
