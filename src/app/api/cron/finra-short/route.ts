import { handleLeasedCron } from '../leasedCron';
import { createFinraShortDeps } from './createDeps';
import { runFinraIngest } from '@/entities/investor-flows/server/ingestFinra';

/** 마감 8분 + 마지막 파일(≤60초 타임아웃 × 재시도) 여유 → 락 TTL 12분. */
const FINRA_SHORT_DEADLINE_MS = 8 * 60 * 1000;
const FINRA_SHORT_LEASE_TTL_SECONDS = 12 * 60;

/**
 * FINRA 공매도 수집 cron(`PATCH /api/cron/finra-short`) — 매 영업일 22:30 UTC.
 * 일별 공매도 거래량(CNMS)과 새 결제일의 공매도 잔고 파일을 받는다.
 *
 * ⚠️ `FINRA_SHORT_DATA_ENABLED=false`면 요청 0건으로 끝난다(비상업 라이선스, 이슈 #1042 —
 * `shared/api/finra/finraShortDataEnabled.ts`).
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'finra-short',
        leaseTtlSeconds: FINRA_SHORT_LEASE_TTL_SECONDS,
        deadlineMs: FINRA_SHORT_DEADLINE_MS,
        run: ({ isDeadlineReached }) =>
            runFinraIngest(createFinraShortDeps(isDeadlineReached)),
    });
}
