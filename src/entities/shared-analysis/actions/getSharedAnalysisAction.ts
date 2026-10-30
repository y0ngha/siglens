'use server';

import { getDatabaseClient } from '@/shared/db/client';
import { logActionError } from '@/shared/lib/logActionError';
import { DrizzleSharedAnalysisRepository } from '../api';
import { isExpired } from '../lib/isExpired';
import { parseSnapshot } from '../lib/parseSnapshot';
import type { SharedAnalysisLookup } from '../types';

/**
 * 공유 id로 스냅샷을 조회한다(공개, 로그인 불필요).
 *
 * - 없음: not_found
 * - 만료: expired
 * - jsonb 형태 불일치: not_found (파싱 실패)
 * - DB 연결 실패 / DATABASE_URL 미설정: not_found (fail-open degrade)
 * - 정상: found + snapshot + createdAt(ISO)
 *
 * 읽기 경로는 의도적으로 rate limit을 두지 않는다: 공유 id는 128비트 추측 불가
 * 토큰이고, 페이지는 noindex이며, React.cache가 한 렌더 안의 호출을 합친다. 읽기
 * 쪽 제한은 보안 이득 없이 정상적인 바이럴 트래픽만 막는다.
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
        // 실패한 SELECT의 바인딩 값은 공유 id(/share/[id]의 추측 불가 접근 토큰)라 원문을 로그에 남기지 않는다.
        logActionError('[getSharedAnalysisAction] lookup failed', error);
        return { status: 'not_found' };
    }
}
