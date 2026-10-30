import 'server-only';
import { isRecord } from '@/shared/lib/isRecord';

function readStringCode(value: unknown): string | undefined {
    if (!isRecord(value)) return undefined;
    return typeof value.code === 'string' ? value.code : undefined;
}

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
    // Drizzle이 감싼 에러는 cause.code, 감싸지 않은 postgres-js/소켓 에러는
    // 최상위 code를 읽는다 (shared/lib/logActionError.ts와 동일, cause 우선).
    const code =
        readStringCode(isRecord(error) ? error.cause : undefined) ??
        readStringCode(error);
    return { errorName, code };
}

/**
 * Logs an internal tool STEP degrading to a fallback (null/undefined/a
 * stale-by-age result) instead of failing the whole tool call —
 * SERVER.md#SA-4: a catch block that swallows an error with no logging
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
