// Run a data loader and return either the rows or a readable error message.
export async function load<T>(
  fn: () => Promise<T[]>
): Promise<{ rows: T[]; error?: undefined } | { rows?: undefined; error: string }> {
  try {
    return { rows: await fn() };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to load data." };
  }
}
