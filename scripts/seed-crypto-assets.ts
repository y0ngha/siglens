import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { cryptoAssets } from '../src/shared/db/schema';
import { fetchCryptoAssetList } from '../src/entities/ticker/lib/fmpCryptoListClient';

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL env var required');
}

async function main() {
    const client = postgres(databaseUrl!, { max: 1 });
    const db = drizzle(client);

    const rows = await fetchCryptoAssetList();
    console.log(`Fetched ${rows.length} crypto assets from FMP`);

    const CHUNK = 500;
    let written = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK);
        await db
            .insert(cryptoAssets)
            .values(chunk)
            .onConflictDoUpdate({
                target: cryptoAssets.symbol,
                set: {
                    name: sql`excluded.name`,
                    circulatingSupply: sql`excluded.circulating_supply`,
                },
            });
        written += chunk.length;
        console.log(`Upserted ${written}/${rows.length}`);
    }
    console.log('crypto_assets seed complete');
    await client.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
