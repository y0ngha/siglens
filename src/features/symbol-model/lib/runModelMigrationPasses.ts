/**
 * One flag-guarded rewrite of a persisted model ID.
 *
 * `flag` is the localStorage key that marks this pass as done in this browser;
 * `from` is the list of stored values the pass rewrites.
 */
export interface ModelMigrationPass {
    flag: string;
    from: readonly string[];
}

interface ModelMigration {
    /** localStorage key holding the persisted model ID. */
    storageKey: string;
    /** Model ID a matching stored value is rewritten to. */
    to: string;
    passes: readonly ModelMigrationPass[];
}

/**
 * Runs each pass at most once per browser: a pass whose flag is present is
 * skipped; otherwise a stored value listed in `from` is rewritten to `to`, and
 * the flag is set **even when there was nothing to rewrite**, so the pass never
 * runs again and a later deliberate choice of a `from` model sticks forever.
 *
 * Idempotent and SSR-safe (no-op without `window`). Only the listed values are
 * rewritten — any other stored model is left intact.
 *
 * Wrapped in try/catch: some browsers (incognito / storage-blocked) throw a
 * `SecurityError` on `localStorage` access. A failed migration must never crash
 * the app at mount, so any storage error is swallowed and treated as a no-op.
 *
 * Shared by the analysis and chat model migrations, which had copied this
 * flag/rewrite/try-catch shell; the per-surface WHY (which values, why a
 * separate flag per pass) stays next to each caller.
 */
export function runModelMigrationPasses({
    storageKey,
    to,
    passes,
}: ModelMigration): void {
    if (typeof window === 'undefined') return;

    try {
        for (const pass of passes) {
            if (localStorage.getItem(pass.flag) !== null) continue;

            const stored = localStorage.getItem(storageKey);
            if (stored !== null && pass.from.includes(stored)) {
                localStorage.setItem(storageKey, to);
            }

            localStorage.setItem(pass.flag, '1');
        }
    } catch {
        // SecurityError (incognito / storage-blocked) — no-op, never crash at mount.
    }
}
