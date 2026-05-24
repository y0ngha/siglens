import {
    resetDatabaseClientForTests,
    tryGetDatabaseClient,
} from '@/shared/db/client';
import type { DatabaseClient } from '@/shared/db/types';

/**
 * Returns a cached `DatabaseClient`, or `null` when `DATABASE_URL` is unset.
 *
 * Used by the ticker use-cases to degrade gracefully when the DB is not
 * configured (e.g. local dev without Neon credentials).
 */
export function tryGetTickerDatabaseClient(): DatabaseClient | null {
    return tryGetDatabaseClient();
}

/** @internal Resets the module-level cached client between test runs. */
export function resetTickerDatabaseClientForTests(): void {
    resetDatabaseClientForTests();
}
