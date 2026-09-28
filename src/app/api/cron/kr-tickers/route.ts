import { constants } from 'node:http2';
import { isAuthorizedCronRequest } from '@/shared/lib/auth/isAuthorizedCronRequest';
import { afterWithDrain } from '@/shared/lib/afterWithDrain';
import { syncKrListedTickers } from '@/entities/ticker/lib/syncKrListedTickers';

const { HTTP_STATUS_UNAUTHORIZED, HTTP_STATUS_ACCEPTED } = constants;

/**
 * 한국 종목 마스터 일 1회 동기화 cron 엔드포인트.
 *
 * `seo-prewarm`의 202 + `after()` 패턴만 가져오고 나머지는 걷어냈다. 그쪽은 5분 간격
 * 10분짜리 LLM 배치라 Redis 루트 락·wall-clock 데드라인·알람 8종이 필요했지만, 여기는
 * **하루 한 번 도는 10초짜리 멱등 작업**이다. 202를 먼저 돌려주므로 EventBridge가
 * 타임아웃으로 재시도하는 일이 없고, 설령 두 번 겹쳐 돌아도 upsert·상폐 표시가 모두
 * 멱등이라 손상이 없다 — 락이 막아 줄 것이 없다.
 *
 * 202를 즉시 반환하는 이유 자체는 그대로다: EventBridge API Destination 타임아웃(~5s)이
 * 공공데이터포털 전 종목 페이지네이션(수 초)보다 짧다.
 */
export async function PATCH(request: Request): Promise<Response> {
    if (!isAuthorizedCronRequest(request)) {
        return new Response(null, { status: HTTP_STATUS_UNAUTHORIZED });
    }

    // SIGTERM 시 drain이 동기화 완료를 기다리도록 등록한다. after()만 쓰면 배포 중
    // 인스턴스 교체가 콜백을 고아로 만들어 그날 동기화가 조용히 사라진다.
    afterWithDrain(async () => {
        try {
            const counts = await syncKrListedTickers();
            console.log('[kr-tickers] sync done:', JSON.stringify(counts));
        } catch (error) {
            console.error('[kr-tickers] sync failed:', error);
        }
    });

    return new Response(null, { status: HTTP_STATUS_ACCEPTED });
}
