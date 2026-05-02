import type { DatabaseConfig } from '@/infrastructure/db/types';

/** Read `DATABASE_URL` from the environment and return a `DatabaseConfig`; throws when the variable is unset. */
export function readDatabaseConfig(): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }
    return { databaseUrl };
}

/** Read `DATABASE_URL` from the environment; returns `null` when the variable is absent. */
export function tryReadDatabaseConfig(): DatabaseConfig | null {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return null;
    return { databaseUrl };
}
