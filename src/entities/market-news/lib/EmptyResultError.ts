/**
 * Thrown inside the cache fetcher when FMP returns an empty feed, so `unstable_cache`
 * skips the `set` (avoids freezing `[]` until revalidate). The outer catch degrades
 * gracefully. Identified by `instanceof`, never by message string.
 */
export class EmptyResultError extends Error {
    constructor(message = 'market news feed returned no items') {
        super(message);
        this.name = 'EmptyResultError';
    }
}
