import { constants } from 'node:http2';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { runAsBatchWork } from '@/shared/lib/renderBudget';
import { syncKrListedTickers } from '@/entities/ticker/lib/syncKrListedTickers';
import { reconcileUsTickerNames } from '@/entities/ticker/lib/reconcileUsTickerNames';
import { createReconcileDeps } from './reconcileDeps';

const { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_ACCEPTED } = constants;

/**
 * 한국 종목 마스터 일 1회 동기화 + 미국 종목 이름 재대조 cron 엔드포인트.
 *
 * 한 호출이 두 단계를 **독립된 try**로 순서대로 돈다 — 한쪽 실패가 다른 쪽을 막지 않는다.
 *   1. KR 동기화(`syncKrListedTickers`): data.go.kr 전 종목 페이지네이션 + upsert.
 *   2. 이름 재대조(`reconcileUsTickerNames`): FMP `stock-list`(약 4만 행, 3.3MB) 1회 수신,
 *      DB 전 행 2회 조회, 최대 `RENAME_BATCH_MAX`(60)개를 담은 Gemini 번역 호출 1회,
 *      심볼별 순차 upsert.
 *
 * **시간 예산은 각 단계 최악의 합이다**(SERVER.md#CC-7). 2단계 최악은 stock-list 수신
 * (`fmpGet` 시도당 10초 × 최대 4회 + 백오프 예산 60초 ≈ 100초) + 번역 1회 + 60심볼 쓰기이고,
 * 거기에 1단계 시간이 앞에 더해진다. 202를 먼저 돌려주고 `after()`로 돌리므로 요청
 * 타임아웃에는 걸리지 않으며, SIGTERM 시 drain이 이 합만큼 기다릴 수 있다.
 *
 * **락이 없는 이유(겹쳐 돌 때의 비용):** 두 단계 모두 멱등이다. 첫 실행이 쓰기를 끝내면 저장
 * 이름이 FMP와 같아져 그 심볼은 후보에서 빠지므로 순차 중복 실행은 비용이 없다. 쓰기가 끝나기
 * 전에 겹친 실행만 같은 후보를 한 번 더 번역하는데, 그 비용은 `RENAME_BATCH_MAX`로 묶인
 * Gemini 호출 1회와 같은 값의 upsert뿐이라 상한이 있다. EventBridge가 하루 한 번만 부르고 202를
 * 먼저 돌려 재시도도 없으므로(겹침은 수동 재호출 정도), Redis 락을 얹는 복잡도보다 이
 * 상한 있는 중복 비용을 받아들이는 쪽이 낫다고 판단했다. 이 상한이 깨지는 변경(배치 상한
 * 확대·번역 호출 분할)을 하면 락(`createRedisLease`)을 함께 검토할 것.
 *
 * 202를 즉시 반환하는 이유: EventBridge API Destination 타임아웃(~5s)이 위 두 단계보다 짧다.
 */
export async function PATCH(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    // SIGTERM 시 drain이 동기화 완료를 기다리도록 등록한다. after()만 쓰면 배포 중
    // 인스턴스 교체가 콜백을 고아로 만들어 그날 동기화가 조용히 사라진다.
    // 배치 표식: FMP·Redis가 렌더 예산이 아니라 배치 정책을 쓴다(`renderBudget.ts`).
    afterWithDrain(() =>
        runAsBatchWork(async () => {
            try {
                const counts = await syncKrListedTickers();
                console.log('[kr-tickers] sync done:', JSON.stringify(counts));
            } catch (error) {
                console.error('[kr-tickers] sync failed:', error);
            }
            // 독립된 try — 두 작업은 서로의 입력이 아니다. KR 동기화(data.go.kr)가
            // 죽어도 미국 종목 이름 재대조(FMP)는 돌아야 하고, 그 반대도 같다.
            try {
                const counts = await reconcileUsTickerNames(
                    createReconcileDeps()
                );
                console.log(
                    '[ticker-names] reconcile done:',
                    JSON.stringify(counts)
                );
            } catch (error) {
                console.error('[ticker-names] reconcile failed:', error);
            }
        })
    );

    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
