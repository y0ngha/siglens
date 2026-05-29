import { getDatabaseClient } from '@/shared/db/client';
import { assetTranslations } from '@/shared/db/schema';

/**
 * Minimal E2E seed: inserts a single AAPL row into `asset_translations`.
 *
 * The `[symbol]` page resolves a ticker through getAssetInfo → cache → the
 * `asset_translations` DB table → FMP. Under E2E (network-guarded, no real FMP),
 * the page calls `notFound()` when getAssetInfo returns null, so this row is the
 * thing that lets `/AAPL` render. There is no `tickers` table in this repo; the
 * authoritative lookup table for asset info is `asset_translations`.
 *
 * Columns set match every NOT-NULL column without a default:
 *   symbol (PK), name, koreanName, fmpSymbol. `updatedAt` has a defaultNow().
 * For US equities the canonical symbol equals the FMP symbol, so fmpSymbol='AAPL'.
 *
 * Runs with E2E_TEST=1 + the .env.e2e DATABASE_URL so the postgres-js swap
 * (Task 2) writes to the local Postgres. `onConflictDoNothing` keeps it
 * idempotent — the Task 1 containers persist data across runs.
 */
async function seed(): Promise<void> {
    const { db } = getDatabaseClient();
    await db
        .insert(assetTranslations)
        .values({
            symbol: 'AAPL',
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        })
        .onConflictDoNothing();
    console.log('e2e seed: ok');
}

seed().then(
    () => process.exit(0),
    e => {
        console.error(e);
        process.exit(1);
    }
);
