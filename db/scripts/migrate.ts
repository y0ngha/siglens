import postgres from 'postgres';
import { readFileSync } from 'fs';
import crypto from 'crypto';
import path from 'path';

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
}

// "already exists" error codes from PostgreSQL
const ALREADY_EXISTS_CODES = new Set(['42P07', '42710', '42P16']);

interface JournalEntry {
    idx: number;
    tag: string;
    when: number;
}

async function runMigrations(): Promise<void> {
    const sql = postgres(databaseUrl!, { max: 1 });
    const drizzleRoot = path.resolve(__dirname, '../../drizzle');

    const journal: { entries: JournalEntry[] } = JSON.parse(
        readFileSync(path.join(drizzleRoot, 'meta/_journal.json'), 'utf-8')
    );

    const applied = await sql<{ hash: string }[]>`
        SELECT hash FROM drizzle.__drizzle_migrations
    `;
    const appliedHashes = new Set(applied.map(r => r.hash));

    for (const entry of journal.entries) {
        const migrationSql = readFileSync(
            path.join(drizzleRoot, `${entry.tag}.sql`),
            'utf-8'
        );
        const hash = crypto
            .createHash('sha256')
            .update(migrationSql)
            .digest('hex');

        if (appliedHashes.has(hash)) {
            console.log(`skip (already applied): ${entry.tag}`);
            continue;
        }

        const statements = migrationSql
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        let allAlreadyExisted = true;

        for (const statement of statements) {
            try {
                await sql.unsafe(statement);
                allAlreadyExisted = false;
            } catch (err: unknown) {
                const code =
                    (err as { code?: string })?.code ??
                    (err as { cause?: { code?: string } })?.cause?.code;
                if (!code || !ALREADY_EXISTS_CODES.has(code)) {
                    await sql.end();
                    throw err;
                }
            }
        }

        await sql`
            INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
            VALUES (${hash}, ${entry.when})
            ON CONFLICT DO NOTHING
        `;

        const label = allAlreadyExisted ? 'baseline' : 'applied';
        console.log(`${label}: ${entry.tag}`);
    }

    await sql.end();
    console.log('Migrations complete');
}

runMigrations().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
