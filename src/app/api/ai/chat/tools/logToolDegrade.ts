import 'server-only';

/**
 * The non-sensitive diagnostics a thrown value is safe to log — never the
 * error object, its `.message`, or `.stack`: a `DrizzleQueryError`'s message
 * (and often its stack) embeds the failed statement's bound params, which
 * for these tools can be the caller's `userId` or a symbol string built from
 * raw model tool-call args. Shared by `logToolError` (`./index.ts`) and
 * `logToolDegrade` below so this extraction exists exactly once.
 */
export function safeErrorFields(error: unknown): {
    errorName: string;
    code: string | undefined;
} {
    const errorName = error instanceof Error ? error.name : 'unknown';
    const rawCode = (error as { cause?: { code?: unknown } } | null)?.cause
        ?.code;
    const code = typeof rawCode === 'string' ? rawCode : undefined;
    return { errorName, code };
}

/**
 * Logs an internal tool STEP degrading to a fallback (null/undefined/a
 * stale-by-age result) instead of failing the whole tool call —
 * MISTAKES.md §0.5: a catch block that swallows an error with no logging
 * removes any way to see why a result silently went missing. Same privacy
 * rule as `logToolError`: never the error object, `.message`, or `.stack`.
 */
export function logToolDegrade(
    toolName: string,
    step: string,
    error: unknown
): void {
    console.error(
        '[AgentTool]',
        toolName,
        `${step} failed, degrading`,
        safeErrorFields(error)
    );
}
