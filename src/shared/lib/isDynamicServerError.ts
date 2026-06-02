/**
 * Detect Next.js's `DYNAMIC_SERVER_USAGE` control-flow error.
 *
 * Next throws a `DynamicServerError` (as a control-flow signal, NOT a real
 * failure) when a dynamic API runs during static / ISR generation. Resilient
 * data wrappers must RETHROW it untouched — swallowing it as an "infra failure"
 * would both log noise and wrongly degrade a render that Next intended to bail
 * out of.
 *
 * Detection is two-pronged because the error shape isn't fully stable:
 *  - `digest === 'DYNAMIC_SERVER_USAGE'` is the primary, exact signal Next sets.
 *  - `message.includes('Dynamic server usage')` is a defensive fallback for
 *    cases where `digest` is absent. It is a SUBSTRING check on purpose — the
 *    message carries a variable suffix ("Route … couldn't be rendered
 *    statically …"), so an exact match would miss it.
 */
export function isDynamicServerError(e: unknown): boolean {
    return (
        e instanceof Error &&
        // `e` is confirmed an Error above; Next's DynamicServerError adds a
        // `digest` field, so the `unknown → { digest? }` read is safe (a missing
        // digest is `undefined`, which fails the comparison).
        ((e as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE' ||
            e.message.includes('Dynamic server usage'))
    );
}
