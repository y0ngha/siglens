/**
 * Detect Next.js's `redirect()` control-flow error so a server action's
 * `try/catch` can RETHROW it untouched instead of reporting it as a failure.
 *
 * Why a message-prefix check instead of Next's `isRedirectError`: that helper
 * lives under `next/dist/client/components/...` (an internal path, not a public
 * export), and the action tests mock `redirect` as
 * `throw new Error(\`NEXT_REDIRECT:${path}\`)` without a `digest`. Next's real
 * redirect error is `new Error('NEXT_REDIRECT')`, so the prefix matches both.
 *
 * This check used to be copied inline into six auth server actions; keeping it
 * in one place means a future change to the detection lands everywhere.
 */
export function isNextRedirectError(err: unknown): boolean {
    return err instanceof Error && err.message.startsWith('NEXT_REDIRECT');
}
