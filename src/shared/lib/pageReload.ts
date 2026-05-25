/** Thin wrapper for testability — vmThreads makes window.location non-configurable. */
export function pageReload(): void {
    window.location.reload();
}
