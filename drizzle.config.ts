import { defineConfig } from 'drizzle-kit';

const databaseUrl = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error(
        'DATABASE_URL environment variable is required for migrations'
    );
}

export default defineConfig({
    schema: './src/shared/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: databaseUrl,
    },
});
