import {
    handleLeasedCron,
    SEC_13F_LEGACY_LEASE_NAME,
    SEC_CRON_LEASE_NAME,
} from '../leasedCron';
import { createSec13fDeps } from './createDeps';
import { run13fIngest } from '@/entities/investor-flows/server/ingest13f';
import { runSecFilingsIngest } from '@/entities/investor-flows/server/ingestSecFilings';
import {
    hasSecFilingsBacklog,
    runSecIndexIngest,
} from '@/entities/investor-flows/server/runSecIndexIngest';

/**
 * 시간 예산(SERVER.md#CC-7)은 **각 단계 최악의 합**이다 — 숫자는 `route.test.ts`가 실제 상수로 다시 계산해 락 TTL과 대조한다:
 *
 *   마감 10분(`SEC_13F_DEADLINE_MS`) — 이 뒤엔 새 제출·새 재반영 다운로드·새 공시 문서를 시작하지 않는다
 * + 진행 중이던 제출 최악 ≈ 7.4분 — 작은 문서 2건 × (30초 × 2회 시도 + 백오프 ≤ 15초) = 2 × 75초,
 *   information table = 헤더(20초 × 2회 + 15초) + 본문 상한 4분(정체 30초 / 전체 `SEC_INFO_TABLE_BODY_BUDGET_MS`) = 295초
 * + RESTATEMENT 재반영 다운로드 최악 ≈ 6.2분 — **마감을 확인한 뒤** 이미 시작한 것 하나(index.json 75초 + information
 *   table 295초 = 370초). 재반영은 교체 전에 모두 내려받으므로 마감 후에는 더 시작하지 않는다.
 *   동시 2개 필러는 병렬이라 합이 아니라 최댓값이다.
 * + 집계 flush ≈ 2.5분 — 시간 상자 2분(`INVESTOR_FLOWS_MAINTENANCE_BUDGET_MS`) + 상자가 청크 **사이**에서만 확인되므로
 *   마지막 청크 한 번(`INVESTOR_FLOWS_MAINTENANCE_CHUNK_MS` 30초; 청크 안에서도 다음 분기 재계산 전에 한 번 더 확인한다)
 * + 보존 정리 ≈ 2.5분 — 같은 시간 상자 + 마지막 배치 한 번
 * + Form 144·증자 공시 단계 — 진행 중 문서 최악 75초(작은 문서 하나; 동시 2개는 병렬이라 최댓값) + DB 마무리(저장·하루 1회
 *   정리·백로그 집계) 여유 30초 ≈ 1.75분
 * ≈ 10 + 7.4 + 6.2 + 2.5 + 2.5 + 1.75 ≈ 30.4분 < 락 TTL 35분(여유 약 4.6분). 마감 10분은 두 단계가 나눠 쓴다 — 13F는 공시 몫
 * (`reserve`: 공시 백로그가 있으면 30%, 없으면 1분)을 뺀 데까지, 공시는 `max(마감, 공시 시작 + reserve)`까지
 * (`runSecIndexIngest`). 13F 꼬리가 마감을 넘겨도 공시는 `reserve`만 받으므로 `(10분 − reserve) + 13F 꼬리 + reserve + 공시 꼬리`로
 * 합은 위와 같다. 남은 일은 전부 durable(dirty 큐·정리 상태·공시 커서·재시도 큐)이라 다음 실행이 잇는다.
 *
 * 스케줄은 2시간마다라 락 TTL이 길어도 겹치지 않는다. 락은 `sec-ftd`와 **공유**한다(`SEC_CRON_LEASE_NAME`) — 동시에 한 SEC
 * cron만 돌아 인스턴스 합계 SEC 속도가 게이트 하나(~4.5건/초)를 넘지 않는다.
 */
const SEC_13F_DEADLINE_MS = 10 * 60 * 1000;
const SEC_13F_LEASE_TTL_SECONDS = 35 * 60;

/**
 * SEC 13F 기관 보유 + Form 144·증자 공시 증분 수집 cron(`PATCH /api/cron/sec-13f`). 일일 커서를 따라 daily index를 읽고, 백필
 * 기간(13F 최근 ~200일, 공시 최근 180일)을 여러 실행에 나눠 소진한다. 2시간마다 호출하는 이유는 처리량이다 — 한 실행이 마감
 * 10분 동안 SEC 게이트(~4.5건/초, 제출 1건 = 요청 3건)로 받을 수 있는 제출은 ≈900건이라(600초 × 4.5 ÷ 3), 첫 백필이 하루 한 번
 * 주기로는 몇 주, 2시간 주기로는 1.5~2일 걸린다(`infra/aws/18-investor-flows-crons.sh`의 스케줄 주석). 13F가 먼저이고 공시는
 * 그 뒤에 자기 몫의 시간으로 매 실행 돈다 — 13F 백필 중에도 Form 144·증자가 굶지 않는다(`runSecIndexIngest`).
 *
 * **cusip-map이 전수 한 바퀴를 끝내기 전에는 아무것도 수집하지 않는다**(`stoppedBy: 'universe_incomplete'`) — 인프라 룰을
 * 한꺼번에 켜도 순서가 코드로 지켜진다. 이유와 표식은 `investorFlowsPolicy.ts`의 `INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE`.
 */
export async function PATCH(request: Request): Promise<Response> {
    return handleLeasedCron(request, {
        name: 'sec-13f',
        leaseName: SEC_CRON_LEASE_NAME,
        // 공유 락을 도입한 이 릴리스의 롤링 배포 동안 옛 인스턴스(옛 키만 잡는다)와 겹치지 않게 옛 키도 잡는다.
        // TODO(investor-flows 확장 다음 릴리스): 옛 인스턴스가 모두 내려간 뒤 지운다(`SEC_13F_LEGACY_LEASE_NAME` JSDoc).
        legacyLeaseNames: [SEC_13F_LEGACY_LEASE_NAME],
        leaseTtlSeconds: SEC_13F_LEASE_TTL_SECONDS,
        deadlineMs: SEC_13F_DEADLINE_MS,
        run: ({ isDeadlineReached }) => {
            const deps = createSec13fDeps(isDeadlineReached);
            // 단계별 마감은 `runSecIndexIngest`가 실행 마감에서 나눠 각 단계 deps의 `isDeadlineReached`를 덮어쓴다.
            return runSecIndexIngest({
                deadlineMs: SEC_13F_DEADLINE_MS,
                now: () => performance.now(),
                hasFilingsBacklog: () => hasSecFilingsBacklog(deps.filings),
                run13f: stepDeadline =>
                    run13fIngest({
                        ...deps.thirteenF,
                        isDeadlineReached: stepDeadline,
                    }),
                runFilings: stepDeadline =>
                    runSecFilingsIngest({
                        ...deps.filings,
                        isDeadlineReached: stepDeadline,
                    }),
            });
        },
    });
}
