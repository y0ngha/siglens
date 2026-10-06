import { DrizzleSessionRepository } from '@/entities/auth/api';
import { DrizzleSharedAnalysisRepository } from '@/entities/shared-analysis/api';
import type { SiglensDatabase } from '@/shared/db/types';

/**
 * 만료 행 정리 결과. 각 값은 이번 tick에 지운 행 수이고, 그 테이블 정리가 실패했으면
 * `null`이다(0과 구분해야 "지울 게 없었다"와 "못 지웠다"를 로그에서 가를 수 있다).
 */
export interface PruneExpiredRowsResult {
    sessionsDeleted: number | null;
    sharedAnalysesDeleted: number | null;
}

async function settle(
    label: string,
    run: () => Promise<number>
): Promise<number | null> {
    try {
        return await run();
    } catch (error) {
        console.error(`[seo-prewarm] expiry prune ${label} failed:`, error);
        return null;
    }
}

/**
 * `sessions` / `shared_analyses`의 만료 행 정리 — seo-prewarm cron의 보존 정리 단계에
 * `pruneAnalysisHistory`와 나란히 얹힌다(별도 엔드포인트·스케줄을 만들지 않는다).
 *
 * 둘 다 지우는 경로가 없었다: 세션은 로그아웃할 때만, 공유 스냅샷은 아예 지워지지 않아
 * 만료 행이 계속 쌓였다. 각 테이블은 서로 격리한다 — 한쪽 실패가 다른 쪽이나 cron의
 * 락 해제를 막지 않는다. **절대 throw하지 않는다.**
 */
export async function pruneExpiredRows(
    db: SiglensDatabase,
    now: Date = new Date()
): Promise<PruneExpiredRowsResult> {
    const sessionsDeleted = await settle('sessions', () =>
        new DrizzleSessionRepository(db).pruneExpiredSessions(now)
    );
    const sharedAnalysesDeleted = await settle('shared_analyses', () =>
        new DrizzleSharedAnalysisRepository(db).pruneExpired(now)
    );
    return { sessionsDeleted, sharedAnalysesDeleted };
}
