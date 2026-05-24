import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { readDatabaseConfig, tryReadDatabaseConfig } from './config';
import * as schema from './schema';
import type { DatabaseClient, DatabaseConfig } from './types';

let cachedClient: DatabaseClient | null = null;

/** Creates a new Drizzle client backed by Neon serverless. */
export function createDatabaseClient(config: DatabaseConfig): DatabaseClient {
    const sql = neon(config.databaseUrl);
    const db = drizzle(sql, { schema });
    return { db, sql };
}

/** Returns the cached `DatabaseClient`, creating it on first call; throws when `DATABASE_URL` is unset. */
export function getDatabaseClient(): DatabaseClient {
    cachedClient ??= createDatabaseClient(readDatabaseConfig());
    return cachedClient;
}

/** Returns the cached `DatabaseClient`, or `null` when `DATABASE_URL` is absent (graceful degradation). */
export function tryGetDatabaseClient(): DatabaseClient | null {
    const config = tryReadDatabaseConfig();
    if (config === null) return null;
    cachedClient ??= createDatabaseClient(config);
    return cachedClient;
}

/** @internal Resets the module-level cached client between test runs. */
export function resetDatabaseClientForTests(): void {
    cachedClient = null;
}
