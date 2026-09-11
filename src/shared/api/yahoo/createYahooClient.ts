import 'server-only';
import YahooFinance from 'yahoo-finance2';
import { MS_PER_SECOND } from '@/shared/config/time';
import { assertOnline, OFFLINE_BUILD_SERVICE } from '@/shared/api/offlineBuild';

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
/** `fetch`에 넘어온 `RequestInfo | URL`을 로그/에러 메시지용 문자열로 좁힌다. */
function describeFetchInput(input: Parameters<typeof fetch>[0]): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url;
}

/** 메서드 호출 첫 인자(대개 심볼 문자열)를 에러 메시지용으로 좁힌다. */
function describeFirstArg(arg: unknown): string {
    if (typeof arg === 'string') return arg;
    if (arg === undefined) return '(no args)';
    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
}

/**
 * offline 가드를 걸 네트워크 메서드 allowlist.
 *
 * 전체 함수 프로퍼티를 다 감싸지 않고 이 목록만 감싸는 이유: yahoo-finance2가
 * 동기 헬퍼(예: `_setOpts`)를 노출할 수도 있는데, 그런 걸 Promise.reject로
 * 감싸버리면 동기 시맨틱이 깨진다. 목록에 없는 프로퍼티는 손대지 않고
 * 그대로 통과시킨다.
 *
 * 구성: (a) 이 레포에서 실제로 호출하는 메서드(`git grep -nE
 * "yahooFinance\.(\w+)\("`로 확인 — chart/quote/search/options/
 * fundamentalsTimeSeries/quoteSummary) + (b) 설치된 yahoo-finance2 버전이
 * 제공하는 나머지 네트워크 모듈 전부(`node_modules/yahoo-finance2/esm/src/modules`).
 * **새 네트워크 메서드를 쓰게 되면 반드시 여기 추가해야 한다** — 안 그러면
 * fetch 레벨 백스톱까지는 막히지만(아래 `createYahooClient`의 `fetch` 옵션 참고)
 * crumb 공유 경로 문제(quote와 동일한 유형)는 재현될 수 있다.
 */
const YAHOO_NETWORK_METHODS: ReadonlySet<string> = new Set([
    'autoc',
    'chart',
    'dailyGainers',
    'dailyLosers',
    'fundamentalsTimeSeries',
    'historical',
    'insights',
    'options',
    'quote',
    'quoteSummary',
    'recommendationsBySymbol',
    'screener',
    'search',
    'trendingSymbols',
]);

/**
 * `quote`/`chart`/`search` 등 allowlist에 있는 메서드 호출을 가로채 offline이면
 * 라이브러리에 진입하기 전에 즉시 reject한다.
 *
 * **fetch 레벨 가드만으로는 부족한 이유**: `quote`는 내부적으로 crumb/cookie를 먼저
 * 받아오는 별도 경로(`lib/getCrumb.js`)를 타는데, 거기서 주입된 fetch가 throw하면
 * 그 경로가 공유하는 crumb promise가 영영 resolve/reject되지 않고 멈춘다 — 이후
 * 모든 `quote` 호출이 그 promise를 기다리며 함께 걸린다(실측: `/market/kr` prerender가
 * 60초 타임아웃에 3번 연속 걸림). 메서드 자체를 라이브러리 밖에서 막으면 그 crumb
 * 경로에 아예 들어가지 않으므로 이 문제가 원천적으로 없다. fetch 레벨 가드는
 * 백스톱으로 남겨 둔다(예: 라이브러리가 향후 fetch를 우회하지 않는 새 경로를 추가해도
 * 걸리도록).
 */
function guardMethodsAgainstOfflineBuild<T extends object>(client: T): T {
    return new Proxy(client, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (typeof value !== 'function') return value;
            if (typeof prop !== 'string' || !YAHOO_NETWORK_METHODS.has(prop))
                return value;
            return new Proxy(value, {
                apply(fn, _thisArg, args: unknown[]) {
                    try {
                        assertOnline(
                            OFFLINE_BUILD_SERVICE.YAHOO,
                            `${String(prop)} ${describeFirstArg(args[0])}`
                        );
                    } catch (error) {
                        return Promise.reject(error);
                    }
                    // `this`는 프록시가 아니라 실제 인스턴스로 넘긴다 — 라이브러리
                    // 메서드가 프로토타입 메서드라 내부에서 `this._opts` 등 사설
                    // 필드에 접근하는데, 프록시를 그대로 넘기면 의미상 동일해도
                    // 불필요한 트랩 재귀를 만든다.
                    return Reflect.apply(fn, target, args);
                },
            });
        },
    });
}

export function createYahooClient(): InstanceType<typeof YahooFinance> {
    const client = new YahooFinance({
        // 첫 호출에 뜨는 마케팅 배너와, 비정형 응답에서 쏟아지는 다중 행 스키마 경고를
        // 억제한다. throw 동작은 그대로라 에러 처리 경로는 바뀌지 않는다.
        suppressNotices: ['yahooSurvey' as const],
        validation: { logErrors: false },
        fetch: (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
            // 백스톱. 정상 경로에서는 `guardMethodsAgainstOfflineBuild`가 메서드
            // 호출 단계에서 이미 막아 여기까지 오지 않는다 — `quote`가 타는 crumb
            // 경로(`lib/getCrumb.js`)는 여기서 막아도 이미 늦다(위 함수 설명 참고).
            // 그래도 남겨 두는 이유는 라이브러리가 향후 우리가 감싸지 않은 새 진입점
            // (예: 내부에서 직접 만드는 보조 클라이언트)으로 네트워크를 탈 경우의
            // 마지막 안전망이기 때문이다.
            assertOnline(
                OFFLINE_BUILD_SERVICE.YAHOO,
                describeFetchInput(input)
            );
            const timeout = AbortSignal.timeout(YAHOO_FETCH_TIMEOUT_MS);
            // 호출부가 이미 시그널을 넘겼으면 둘 중 먼저 끊기는 쪽을 따른다 —
            // 우리 타임아웃이 상위 취소를 삼켜 버리지 않게 한다.
            const signal = init?.signal
                ? AbortSignal.any([init.signal, timeout])
                : timeout;
            return fetch(input, { ...init, signal });
        },
    });
    return guardMethodsAgainstOfflineBuild(client);
}
