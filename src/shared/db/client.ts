import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { readDatabaseConfig, tryReadDatabaseConfig } from './config';
import * as schema from './schema';
import type { DatabaseClient, DatabaseConfig } from './types';
import { isE2E } from '@/shared/api/e2eEnv';

let cachedClient: DatabaseClient | null = null;

/** Creates a new Drizzle client backed by Neon serverless. */
export function createDatabaseClient(config: DatabaseConfig): DatabaseClient {
    const sql = neon(config.databaseUrl);
    const db = drizzle(sql, { schema });
    return { db, sql };
}

/**
 * Builds a `DatabaseClient` for the active environment: the local postgres-js
 * adapter under E2E_TEST, otherwise the production Neon serverless client.
 * The `require` (not `import`) keeps postgres-js out of the production bundle.
 */
function buildClient(config: DatabaseConfig): DatabaseClient {
    if (isE2E()) {
        // require keeps postgres-js out of the production bundle.
        const clientTest =
            require('./clientTest') as typeof import('./clientTest');
        return clientTest.createTestDatabaseClient(config);
    }
    return createDatabaseClient(config);
}

/** Returns the cached `DatabaseClient`, creating it on first call; throws when `DATABASE_URL` is unset. */
export function getDatabaseClient(): DatabaseClient {
    cachedClient ??= buildClient(readDatabaseConfig());
    return cachedClient;
}

/** Returns the cached `DatabaseClient`, or `null` when `DATABASE_URL` is absent (graceful degradation). */
export function tryGetDatabaseClient(): DatabaseClient | null {
    const config = tryReadDatabaseConfig();
    if (config === null) return null;
    cachedClient ??= buildClient(config);
    return cachedClient;
}

/** @internal Resets the module-level cached client between test runs. */
export function resetDatabaseClientForTests(): void {
    cachedClient = null;
}
