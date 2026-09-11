/**
 * Logs a server-action failure without leaking query content. A
 * `DrizzleQueryError`'s `.message` embeds the failed statement's bound
 * params — for `renameConversationAction` that includes the member's raw
 * title text — so logging `error` directly would put arbitrary user input
 * into server logs. Only the error's `name` and (if present) the
 * driver-supplied SQLSTATE-ish `cause.code` are safe, non-sensitive
 * diagnostics.
 */
export function logActionError(tag: string, error: unknown): void {
    const name = error instanceof Error ? error.name : 'unknown';
    const rawCode = (error as { cause?: { code?: unknown } } | null)?.cause
        ?.code;
    // Only a short driver code string is a safe diagnostic; anything else could carry payload.
    const code = typeof rawCode === 'string' ? rawCode : undefined;
    console.error(tag, { name, code });
}
