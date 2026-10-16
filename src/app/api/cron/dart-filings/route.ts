import { DART_CRON_LEASE_NAME, handleLeasedCron } from '../leasedCron';
import { createDartFilingsDeps } from './createDeps';
import { runDartFilingsIngest } from '@/entities/investor-flows/server/ingestDartFilings';

/**
 * 시간 예산(SERVER.md#CC-7): 마감 18분 + 진행 중 회사 하나 최악 ≈ 4.1분(호출 2건 × 시도 2회 × (요청 30초 + 할당량 가드의
 * Redis 명령 3개 × 10초) + 백오프 ≤ 2초씩) + DB 여유 3분(대기열·거래계획 upsert, 상태 저장, 2년 정리) ≈ 25.1분 < 락 TTL 30분.
 * 보통은 호출 상한(실행당 1,500건, 속도 게이트 100ms)에 먼저 닿는다. 숫자는 `route.test.ts`가 실제 상수로 다시 계산한다.
 */
const DART_FILINGS_DEADLINE_MS = 18 * 60 * 1000;
const DART_FILINGS_LEASE_TTL_SECONDS = 30 * 60;

/**
 * 한국 DART 지분공시 수집 cron(`PATCH /api/cron/dart-filings`) — 하루 2회(00:30·09:30 UTC). 공시검색으로 새 대량보유·임원
 * 소유보고가 있는 회사만 다시 받고, 거래계획보고서 목록 행을 저장하며, 남는 호출로 최초 백필을 잇는다.
 * `dart-corp-code`와 **공유 락**(`DART_CRON_LEASE_NAME`)을 잡는다 — 한 번에 한 DART cron만 돈다.
 *
 * `DART_API_KEY`가 없으면 요청 0건으로 `disabled`(`shared/api/dart/dartClient.ts`).
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'dart-filings',
        leaseName: DART_CRON_LEASE_NAME,
        leaseTtlSeconds: DART_FILINGS_LEASE_TTL_SECONDS,
        deadlineMs: DART_FILINGS_DEADLINE_MS,
        run: ({ isDeadlineReached }) =>
            runDartFilingsIngest(createDartFilingsDeps(isDeadlineReached)),
    });
}
