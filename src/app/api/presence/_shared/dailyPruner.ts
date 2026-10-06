import { constants } from 'node:http2';
import { kstDateKeyDaysBefore } from '@/shared/lib/etTimeUtils';

const { HTTP_STATUS_NO_CONTENT } = constants;

/** 수집 비콘은 결과와 무관하게 본문 없는 204로 끝난다. */
export function noContent(): Response {
    return new Response(null, { status: HTTP_STATUS_NO_CONTENT });
}

interface PrunableRepository {
    pruneOlderThan(cutoffDate: string): Promise<void>;
}

/**
 * 보존 기간 집행기 — 인스턴스당 KST 하루 1회 오래된 행을 지운다.
 *
 * 보존 기간 집행을 위해 별도 EventBridge cron을 만들지 않는다. `DELETE`는
 * 멱등이라 인스턴스가 몇 개든, 같은 날 몇 번 돌든 결과가 같다. 트래픽이 0이면
 * 정리도 안 돌지만 그때는 지울 행도 없다.
 *
 * 호출부는 **기록이 성공한 뒤에만** 부른다. DB가 죽어 있으면 정리도 어차피
 * 실패할 뿐 아니라, 마지막 정리 날짜를 오늘로 소진해 버리면 그날 남은 요청이
 * 전부 정리를 건너뛴다 — 다음 성공 요청에 기회를 남긴다.
 *
 * 응답 경로 밖에서 부른다 — 호출부가 기록과 함께 `after()` 콜백 안에서 순서대로
 * 실행한다(기록 → 정리). 그래서 이 함수 자체는 `after()`를 다시 걸지 않고 정리를
 * 끝까지 기다린다. 실패는 로그만 남기고 삼킨다(반환 프라미스는 reject되지 않는다).
 *
 * 반환된 함수가 날짜 상태를 클로저로 쥐므로, 라우트 모듈 최상위에서 한 번만
 * 만든다(모듈 수명 = 인스턴스 수명).
 *
 * @param retentionDays 보존 일수. 오늘(KST)에서 이만큼 이전 날짜보다 오래된 행을 지운다.
 * @param logTag        실패 로그 접두사(예: `[visitor-metrics]`).
 */
export function createDailyPruner(
    retentionDays: number,
    logTag: string
): (today: string, repo: PrunableRepository) => Promise<void> {
    let lastPrunedDate: string | null = null;
    return async (today, repo) => {
        if (lastPrunedDate === today) return;
        lastPrunedDate = today;
        try {
            await repo.pruneOlderThan(
                kstDateKeyDaysBefore(today, retentionDays)
            );
        } catch (error) {
            // 다음 날 다시 시도된다.
            console.error(`${logTag} prune failed:`, error);
        }
    };
}
