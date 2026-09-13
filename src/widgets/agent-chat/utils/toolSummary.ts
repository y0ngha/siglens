/**
 * `ToolActivityItem.summary` is the executor's truncated JSON result
 * (core `runAgentTurn` `summarize()`), never guaranteed to parse — a
 * truncated payload cuts mid-string. Any parse failure reads as "no error",
 * never as a false match.
 */
export function toolResultError(summary: string | undefined): string | null {
    if (!summary) return null;
    try {
        const parsed: unknown = JSON.parse(summary);
        const error =
            typeof parsed === 'object' && parsed !== null
                ? (parsed as { error?: unknown }).error
                : undefined;
        return typeof error === 'string' ? error : null;
    } catch {
        return null;
    }
}
