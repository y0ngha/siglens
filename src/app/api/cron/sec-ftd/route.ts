import { handleLeasedCron, SEC_CRON_LEASE_NAME } from '../leasedCron';
import { createSecFtdDeps } from './createDeps';
import { runFtdIngest } from '@/entities/investor-flows/server/ingestFtd';

/**
 * 시간 예산(SERVER.md#CC-7): 마감 5분 + 진행 중 파일 하나 최악 75초(`www.sec.gov/files` 요청 30초 × 2회 시도 + 백오프 ≤ 15초 —
 * 목록 페이지도 같다) + DB(파일 하나 ≈ 수만 행 upsert + 정리) 여유 2분 ≈ 8.25분 < 락 TTL 10분. 실행당 파일은 많아야 4개
 * (`INVESTOR_FLOWS_FTD_MAX_FILES_PER_RUN`)라 보통 1분 안에 끝난다. 숫자는 `route.test.ts`가 실제 상수로 다시 계산한다.
 */
const SEC_FTD_DEADLINE_MS = 5 * 60 * 1000;
const SEC_FTD_LEASE_TTL_SECONDS = 10 * 60;

/**
 * SEC fails-to-deliver 수집 cron(`PATCH /api/cron/sec-ftd`) — 매일 1회. 반월 파일을 최신부터 실행당 4개까지 받는다(처음엔 1년치
 * 24개를 며칠에 걸쳐 채운다). `sec-13f`와 **공유 락**(`SEC_CRON_LEASE_NAME`)을 잡는다 — 두 SEC cron이 동시에 돌지 않아야
 * 인스턴스 합계 SEC 속도가 게이트 하나를 넘지 않는다. 락이 잡혀 있으면(13F 실행 중) 204로 건너뛰고 다음 날 다시 돈다.
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'sec-ftd',
        leaseName: SEC_CRON_LEASE_NAME,
        leaseTtlSeconds: SEC_FTD_LEASE_TTL_SECONDS,
        deadlineMs: SEC_FTD_DEADLINE_MS,
        run: ({ isDeadlineReached }) =>
            runFtdIngest(createSecFtdDeps(isDeadlineReached)),
    });
}
