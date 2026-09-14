import { unstable_isUnrecognizedActionError } from 'next/navigation';

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
    window.location.reload();
    return true;
}
