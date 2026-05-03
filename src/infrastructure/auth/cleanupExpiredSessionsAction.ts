'use server';

import { headers } from 'next/headers';
import { DrizzleSessionRepository } from '@/infrastructure/db/sessionRepository';
import { getAuthDatabaseClient } from '@/infrastructure/auth/db';

/** Result of {@link cleanupExpiredSessionsAction}. */
export interface CleanupExpiredSessionsResult {
    /** Number of session rows actually deleted. */
    deleted: number;
}

/** Thrown when the action is invoked without a valid CRON_SECRET bearer. */
export class CleanupUnauthorizedError extends Error {
    constructor() {
        super('cleanup_unauthorized');
        this.name = 'CleanupUnauthorizedError';
    }
}

/**
 * Delete all sessions whose `expiresAt` is in the past.
 *
 * Invoke from a scheduled cron or admin route; not yet wired. Exposed as a
 * Server Action so any future scheduler (Vercel Cron, GitHub Action, admin
 * page) can call it without re-wiring the database client.
 *
 * Caller MUST send `Authorization: Bearer ${CRON_SECRET}`. The action throws
 * {@link CleanupUnauthorizedError} when the header is missing or the secret
 * env var is unset (fail-closed). This is defence-in-depth — Server Action
 * IDs are not publicly enumerable but a bulk-delete entry point should not
 * trust obscurity alone.
 */
export async function cleanupExpiredSessionsAction(): Promise<CleanupExpiredSessionsResult> {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        throw new CleanupUnauthorizedError();
    }
    const headerList = await headers();
    const authorization = headerList.get('authorization');
    if (authorization !== `Bearer ${expected}`) {
        throw new CleanupUnauthorizedError();
    }

    const { db } = getAuthDatabaseClient();
    const repository = new DrizzleSessionRepository(db);
    const deleted = await repository.deleteExpiredSessions();
    return { deleted };
}
