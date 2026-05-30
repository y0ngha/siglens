import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import type { DatabaseClient, DatabaseConfig } from './types';

/**
 * E2E-only DatabaseClient backed by node `postgres` + drizzle postgres-js.
 *
 * Production uses Neon serverless (see client.ts). The drizzle query API is
 * runtime-compatible across both adapters; the cast bridges the driver-specific
 * TS types (NeonHttpDatabase vs PostgresJsDatabase) at this single boundary.
 * Reached only when E2E_TEST=1 so postgres-js never enters the prod bundle.
 */
export function createTestDatabaseClient(
    config: DatabaseConfig
): DatabaseClient {
    const sql = postgres(config.databaseUrl, { max: 4 });
    const db = drizzle(sql, { schema });
    return { db, sql } as unknown as DatabaseClient;
}
