'use server';

import { timingSafeEqual } from 'crypto';
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

/** Authorization Bearer 토큰을 타이밍-세이프하게 비교 (verifyOAuthState 패턴과 일치). */
function safeBearerCompare(actual: string | null, expected: string): boolean {
    if (actual === null) return false;
    const expectedToken = `Bearer ${expected}`;
    const a = Buffer.from(actual);
    const b = Buffer.from(expectedToken);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

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
