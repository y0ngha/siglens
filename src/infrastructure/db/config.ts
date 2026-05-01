import type { DatabaseConfig } from './types';

/**
 * Reads `DATABASE_URL` from the environment and returns a `DatabaseConfig`.
 * @returns A `DatabaseConfig` containing the resolved `databaseUrl`.
 * @throws {Error} When `DATABASE_URL` is not set.
 */
export function readDatabaseConfig(): DatabaseConfig {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error('DATABASE_URL environment variable is required');
    }
    return { databaseUrl };
}

/**
 * Reads `DATABASE_URL` from the environment.
 * @returns A `DatabaseConfig` when the variable is set, or `null` when absent.
 */
export function tryReadDatabaseConfig(): DatabaseConfig | null {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) return null;
    return { databaseUrl };
}

