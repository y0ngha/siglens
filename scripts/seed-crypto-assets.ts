import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { cryptoAssets } from '../src/shared/db/schema';
import { fetchCryptoAssetList } from '../src/entities/ticker/api';

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL env var required');
}

async function main() {
    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzle(client);

    const rows = await fetchCryptoAssetList();
    console.log(`Fetched ${rows.length} crypto assets from FMP`);

    // Dedupe by symbol to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
    const uniqueRows = Array.from(
        new Map(rows.map(r => [r.symbol, r])).values()
    );
    const total = uniqueRows.length;

    const CHUNK = 500;
    let written = 0;
    for (let i = 0; i < total; i += CHUNK) {
        const chunk = uniqueRows.slice(i, i + CHUNK);
        await db
            .insert(cryptoAssets)
            .values(chunk)
            .onConflictDoUpdate({
                target: cryptoAssets.symbol,
                set: {
                    name: sql`excluded.name`,
                    circulatingSupply: sql`excluded.circulating_supply`,
                    // Drizzle does NOT run $onUpdateFn on conflict-update, so
                    // updatedAt must be set explicitly to avoid going stale.
                    updatedAt: sql`now()`,
                },
            });
        written += chunk.length;
        console.log(`Upserted ${written}/${total}`);
    }
    console.log('crypto_assets seed complete');
    await client.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
