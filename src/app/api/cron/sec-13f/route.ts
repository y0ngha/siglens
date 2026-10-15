import { handleLeasedCron } from '../leasedCron';
import { createSec13fDeps } from './createDeps';
import { run13fIngest } from '@/entities/investor-flows/server/ingest13f';

/**
 * 시간 예산(SERVER.md#CC-7)은 **각 단계 최악의 합**이다 — 숫자는 `route.test.ts`가 실제 상수로 다시 계산해 락 TTL과 대조한다:
 *
 *   마감 10분(`SEC_13F_DEADLINE_MS`) — 이 뒤엔 새 제출·새 재반영 다운로드를 시작하지 않는다
 * + 진행 중이던 제출 최악 ≈ 7.4분 — 작은 문서 2건 × (30초 × 2회 시도 + 백오프 ≤ 15초) = 2 × 75초,
 *   information table = 헤더(20초 × 2회 + 15초) + 본문 상한 4분(정체 30초 / 전체 `SEC_INFO_TABLE_BODY_BUDGET_MS`) = 295초
 * + RESTATEMENT 재반영 다운로드 최악 ≈ 6.2분 — **마감을 확인한 뒤** 이미 시작한 것 하나(index.json 75초 + information
 *   table 295초 = 370초). 재반영은 교체 전에 모두 내려받으므로 마감 후에는 더 시작하지 않는다.
 *   동시 2개 필러는 병렬이라 합이 아니라 최댓값이다.
 * + 집계 flush ≈ 2.5분 — 시간 상자 2분(`INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS`) + 상자가 청크 **사이**에서만 확인되므로
 *   마지막 청크 한 번(`INVESTOR_FLOWS_MAINTENANCE_CHUNK_MS` 30초; 청크 안에서도 다음 분기 재계산 전에 한 번 더 확인한다)
 * + 보존 정리 ≈ 2.5분 — 같은 시간 상자 + 마지막 배치 한 번
 * ≈ 10 + 7.4 + 6.2 + 2.5 + 2.5 = 28.6분 < 락 TTL 35분(여유 약 6분). 남은 일은 전부 durable(dirty 큐·정리 상태)이라 다음
 * 실행이 잇는다.
 *
 * 스케줄은 2시간마다라 락 TTL이 길어도 겹치지 않는다.
 */
const SEC_13F_DEADLINE_MS = 10 * 60 * 1000;
const SEC_13F_LEASE_TTL_SECONDS = 35 * 60;

/**
 * SEC 13F 기관 보유 증분 수집 cron(`PATCH /api/cron/sec-13f`) — 설계 §3. 2시간마다 호출되며 일일 커서를
 * 따라 daily index를 읽고, 백필 기간(최근 ~200일)을 소진할 때까지 여러 번에 나눠 처리한다.
 *
 * **cusip-map이 전수 한 바퀴를 끝내기 전에는 아무것도 수집하지 않는다**(`stoppedBy: 'universe_incomplete'`) — 인프라 룰을
 * 한꺼번에 켜도 순서가 코드로 지켜진다. 이유와 표식은 `investorFlowsPolicy.ts`의 `INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE`.
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'sec-13f',
        leaseTtlSeconds: SEC_13F_LEASE_TTL_SECONDS,
        deadlineMs: SEC_13F_DEADLINE_MS,
        run: ({ isDeadlineReached }) =>
            run13fIngest(createSec13fDeps(isDeadlineReached)),
    });
}
