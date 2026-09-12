/**
 * Thin wrappers around `window.location.assign`/`replace`, same shape as
 * `pageReload.ts` — kept separate from the caller so tests mock this module
 * instead of `window.location` (non-configurable under some Vitest pools).
 *
 * Used only when a `LocaleContext` `hrefBase` sends navigation to a different
 * host (e.g. from ai.siglens.io to the main site): the router's client-side
 * `push`/`replace` can't cross origins, so these fall back to a real
 * navigation. `assign` keeps a history entry (mirrors `router.push`);
 * `replace` does not (mirrors `router.replace`).
 */
export function assignLocation(url: string): void {
    window.location.assign(url);
}

export function replaceLocation(url: string): void {
    window.location.replace(url);
}
