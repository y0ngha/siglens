import 'server-only';
import YahooFinance from 'yahoo-finance2';
import { MS_PER_SECOND } from '@/shared/config/time';

/**
 * yahoo 요청 하나의 상한(ms).
 *
 * FMP 클라이언트(`shared/api/fmp/httpClient.ts`)가 쓰는 10초보다 짧게 잡았다. yahoo는
 * **종목 페이지 렌더를 막는 경로**에 있기 때문이다 — `[symbol]/layout.tsx`가 Suspense
 * 밖에서 `getAssetInfoResilient`를 await하고, 국내 종목은 그 안에서 yahoo quote를 탄다.
 * ALB idle timeout이 60초라 그 전에 우리가 먼저 끊어야 502/504가 아니라 우리 degrade
 * 경로로 떨어진다.
 */
export const YAHOO_FETCH_TIMEOUT_MS = 8 * MS_PER_SECOND;

/**
 * 타임아웃이 걸린 yahoo 클라이언트를 만든다.
 *
 * **라이브러리 기본 timeout은 쓸 수 없다.** `queue.timeout`은 3.15.3에서 주석 처리돼
 * 있고(`lib/options/defaults.js`) 큐 구현이 그 값을 읽지도 않는다 — 죽은 속성이다.
 * 생성자 옵션의 `fetch`는 실제로 반영되므로(`lib/yahooFinanceFetch.js`가
 * `this._opts.fetch`를 우선한다) 거기에 per-call 시그널을 얹는다.
 *
 * **왜 `fetchOptions.signal`이 아닌가**: 그건 인스턴스마다 한 번 만들어지는 정적
 * 옵션이라, `AbortSignal.timeout`을 넣으면 첫 8초 뒤 그 시그널이 이미 abort된 상태로
 * 굳어 이후 모든 호출이 즉시 실패한다. 시그널은 호출마다 새로 만들어야 한다.
 *
 * **타임아웃이 없을 때 무슨 일이 나는가**: 라이브러리는 모든 인스턴스가 공유하는
 * 큐를 `concurrency: 4`로 돌린다. 소켓 4개가 응답 없이 물리면 프로세스 안의 **모든**
 * yahoo 호출이 그 뒤로 직렬화된다 — 무관한 심볼까지 같이 멈춘다.
 */
export function createYahooClient(): InstanceType<typeof YahooFinance> {
    return new YahooFinance({
        // 첫 호출에 뜨는 마케팅 배너와, 비정형 응답에서 쏟아지는 다중 행 스키마 경고를
        // 억제한다. throw 동작은 그대로라 에러 처리 경로는 바뀌지 않는다.
        suppressNotices: ['yahooSurvey' as const],
        validation: { logErrors: false },
        fetch: (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
            const timeout = AbortSignal.timeout(YAHOO_FETCH_TIMEOUT_MS);
            // 호출부가 이미 시그널을 넘겼으면 둘 중 먼저 끊기는 쪽을 따른다 —
            // 우리 타임아웃이 상위 취소를 삼켜 버리지 않게 한다.
            const signal = init?.signal
                ? AbortSignal.any([init.signal, timeout])
                : timeout;
            return fetch(input, { ...init, signal });
        },
    });
}
