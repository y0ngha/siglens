'use server';

import { headers } from 'next/headers';
import { safeBearerCompare } from '@/shared/lib/auth/safeBearerCompare';
import { DrizzleSessionRepository } from '../api';
import { getAuthDatabaseClient } from '../lib/db';
import {
    CleanupUnauthorizedError,
    type CleanupExpiredSessionsResult,
} from './cleanupTypes';

/** 만료된 세션 일괄 삭제 — `Authorization: Bearer ${CRON_SECRET}` 필수 (fail-closed). */
export async function cleanupExpiredSessionsAction(): Promise<CleanupExpiredSessionsResult> {
    const expected = process.env.CRON_SECRET;
    if (!expected) {
        throw new CleanupUnauthorizedError();
    }
    const headerList = await headers();
    const authorization = headerList.get('authorization');
    if (!safeBearerCompare(authorization, expected)) {
        throw new CleanupUnauthorizedError();
    }

    const { db } = getAuthDatabaseClient();
    const repository = new DrizzleSessionRepository(db);
    const deleted = await repository.deleteExpiredSessions();
    return { deleted };
}
