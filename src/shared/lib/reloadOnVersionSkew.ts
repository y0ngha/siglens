import { unstable_isUnrecognizedActionError } from 'next/navigation';
import { pageReload } from '@/shared/lib/pageReload';

/**
 * Server Action IDs change on every build. A tab whose JS came from the previous
 * build (opened before a deploy, or served by an old instance mid-rollout) keeps
 * calling IDs the new server does not know — every action then fails with
 * `Failed to find Server Action`. The visible symptom is the header dropping to
 * "logged out" and member-only analysis never loading, while a manual reload
 * fixes everything (2026-09-14: 56 such errors in the v0.75.3 rollout window).
 *
 * Reloading picks up the current build. The guard stops a reload loop while the
 * ALB still mixes old and new instances: at most one reload per window.
 */
const RELOAD_MARK_KEY = 'siglens:version-skew-reload-at';
const RELOAD_WINDOW_MS = 60_000;

/**
 * Query `meta` that opts a query out of the version-skew reload.
 *
 * An "action not found" is not always a build mismatch. A page-scoped action
 * (registered only on one route's worker) that fires while the user is leaving
 * that route is POSTed to the next route's URL, whose worker does not know it.
 * Reloading then cancels the navigation the user just started. A display-only
 * query whose failure costs nothing sets this; a real skew is still caught by the
 * page's other actions.
 */
export const SKIP_VERSION_SKEW_RELOAD_META = {
    skipVersionSkewReload: true,
} as const;

export function skipsVersionSkewReload(
    meta: Readonly<Record<string, unknown>> | undefined
): boolean {
    return meta?.skipVersionSkewReload === true;
}

export function isVersionSkewError(error: unknown): boolean {
    return unstable_isUnrecognizedActionError(error);
}

export function reloadOnVersionSkew(
    error: unknown,
    now: number = Date.now()
): boolean {
    if (!isVersionSkewError(error)) return false;
    try {
        const last = Number(sessionStorage.getItem(RELOAD_MARK_KEY));
        if (Number.isFinite(last) && now - last < RELOAD_WINDOW_MS)
            return false;
        sessionStorage.setItem(RELOAD_MARK_KEY, String(now));
    } catch {
        // Storage blocked (private mode): without the guard a mixed-version
        // rollout could loop, so don't reload at all.
        return false;
    }
    pageReload();
    return true;
}
