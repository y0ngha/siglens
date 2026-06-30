'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSharedAnalysisRepository } from '../api';
import { parseSnapshot } from '../lib/parseSnapshot';
import { isExpired } from '../lib/isExpired';
import type { SharedAnalysisLookup } from '../types';

/**
 * 공유 id로 스냅샷을 조회한다(공개, 로그인 불필요).
 *
 * - 없음: not_found
 * - 만료: expired
 * - jsonb 형태 불일치: not_found (파싱 실패)
 * - DB 연결 실패 / DATABASE_URL 미설정: not_found (fail-open degrade)
 * - 정상: found + snapshot + createdAt(ISO)
 */
export async function getSharedAnalysisAction(
    id: string
): Promise<SharedAnalysisLookup> {
    try {
        const { db } = getDatabaseClient();
        const repo = new DrizzleSharedAnalysisRepository(db);
        const row = await repo.findById(id);
        if (!row) return { status: 'not_found' };
        if (isExpired(row.expiresAt, new Date())) return { status: 'expired' };
        const snapshot = parseSnapshot(row.snapshotJson);
        if (!snapshot) return { status: 'not_found' };
        return {
            status: 'found',
            snapshot,
            createdAt: row.createdAt.toISOString(),
        };
    } catch (error) {
        console.error('[getSharedAnalysisAction] lookup failed', error);
        return { status: 'not_found' };
    }
}
