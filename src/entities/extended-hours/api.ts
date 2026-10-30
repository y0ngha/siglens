import 'server-only';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { isE2E } from '@/shared/api/e2eEnv';
import { FmpMarketProvider } from '@/shared/api/fmp/FmpMarketProvider';
import type { ExtendedHoursTrade } from '@/shared/api/market/marketProvider.types';
import { getCachedMarketDataProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import {
    QUOTE_LOOKUP_TIMEOUT_MS,
    quoteWithTimeout,
} from '@/shared/api/market/quoteTimeout';
import {
    EXTENDED_QUOTE_CACHE_TTL_SECONDS,
    EXTENDED_QUOTE_TIMEOUT_CACHE_TTL_SECONDS,
} from '@/shared/config/time';
import { SYMBOL_EDGE_RE } from '@/shared/config/ticker';
import { getAssetInfoStatic } from '@/entities/ticker/server/getAssetInfoStatic';
import { marketProfileForAssetInfo } from '@/entities/ticker/lib/resolveMarketProfile';
import {
    buildExtendedQuote,
    type ReferenceQuote,
} from './lib/buildExtendedQuote';
import {
    extendedSessionAt,
    type ExtendedSessionWindow,
} from './lib/extendedSession';
import type { ExtendedHoursQuote } from './model';

/** `SYMBOL_EDGE_RE`가 허용하는 최대 길이 — 정규식 전에 길이부터 본다(SERVER.md#SA-7). */
const SYMBOL_MAX_LENGTH = 16;

let fmpProvider: FmpMarketProvider | null = null;

/** 상태가 없는 어댑터라 한 번만 만든다. E2E는 `loadExtendedHoursQuote`가 먼저 걸러 여기 오지 않는다. */
function getFmpProvider(): FmpMarketProvider {
    fmpProvider ??= new FmpMarketProvider();
    return fmpProvider;
}

/**
 * 확장 시세 전용 캐시 키 — 정규장 시세(`quote:snapshot:`)·봉(`bars:*`) 키 계통과 분리돼 있어
 * 어느 쪽의 키도 바꾸지 않는다.
 */
export function buildExtendedQuoteKey(symbol: string): string {
    return `quote:ext:${symbol.toUpperCase()}`;
}

/** 체결 조회가 상한 안에 끝나지 못했음을 나타내는 표식. */
const TRADE_TIMED_OUT = Symbol('extended-hours-trade-timed-out');

/**
 * `getExtendedHoursTrade`는 `fmpGet` 재시도(429/5xx 백오프)로 ~85초까지 걸릴 수 있고, 그동안 이
 * 탭의 다른 Server Action이 줄을 선다(Server Action은 한 번에 하나씩 나간다). `quoteWithTimeout`과
 * 같은 상한(`QUOTE_LOOKUP_TIMEOUT_MS`)으로 포기한다. 포기한 요청 자체는 취소되지 않고 백그라운드에서
 * 끝난다(`fmpGet`에 신호를 넘길 수 없다).
 */
async function tradeWithTimeout(
    fmpSymbol: string
): Promise<ExtendedHoursTrade | null | typeof TRADE_TIMED_OUT> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<typeof TRADE_TIMED_OUT>(resolve => {
        timer = setTimeout(
            () => resolve(TRADE_TIMED_OUT),
            QUOTE_LOOKUP_TIMEOUT_MS
        );
    });
    try {
        return await Promise.race([
            getFmpProvider().getExtendedHoursTrade(fmpSymbol),
            timeout,
        ]);
    } finally {
        clearTimeout(timer);
    }
}

/** `fetchExtendedQuote` 결과 — `timedOut`이 캐시 TTL(짧게 굳힘)을 가른다. */
interface FetchOutcome {
    value: ExtendedHoursQuote | null;
    timedOut: boolean;
}

/**
 * 체결 → 기준 종가 순으로 조회해 한 줄 시세를 만든다. 어떤 오류든 던지지 않고 `null`로 접는다
 * (오류 객체 대신 이름만 로그).
 */
async function fetchExtendedQuote(
    fmpSymbol: string,
    window: ExtendedSessionWindow,
    now: Date
): Promise<FetchOutcome> {
    const none: FetchOutcome = { value: null, timedOut: false };
    try {
        // 체결부터 본다: 체결이 없으면 기준 종가를 받을 이유가 없다.
        const trade = await tradeWithTimeout(fmpSymbol);
        if (trade === TRADE_TIMED_OUT) return { value: null, timedOut: true };
        if (trade === null) return none;
        // 기준 종가는 `/quote` 스냅샷(`quote:snapshot:<SYM>`)을 재사용한다 — 종목 페이지가 이미
        // 채워 둔 캐시라 보통 FMP 호출이 늘지 않는다. 확장 세션 가격은 이 스냅샷에 섞지 않는다.
        const quote = await quoteWithTimeout(
            getCachedMarketDataProvider(),
            fmpSymbol
        );
        const reference: ReferenceQuote | null =
            quote === null
                ? null
                : { price: quote.price, timestampSec: quote.timestamp };
        return {
            value: buildExtendedQuote({
                window,
                trade,
                reference,
                nowMs: now.getTime(),
            }),
            timedOut: false,
        };
    } catch (error) {
        // 프로바이더 오류 객체는 심볼·URL을 담을 수 있어 이름만 남긴다.
        console.error('[loadExtendedHoursQuote] degraded to null:', {
            errorName: error instanceof Error ? error.name : 'unknown',
        });
        return none;
    }
}

/**
 * 미국 주식의 프리·애프터마켓 한 줄 시세. **표시 전용** — 결과를 봉·지표·분석에 섞지 않는다.
 *
 * 순서가 곧 FMP 대역폭 방어선이다(싼 검사부터):
 * 1. E2E·확장 세션 밖(주말·휴장일·정규장·야간) → `null`. FMP도 Redis도 자산 조회도 건드리지 않는다.
 * 2. 심볼 형식(길이 → 정규식) → `getAssetInfoStatic`으로 자산 정보를 푼다. 이게 **받아들인
 *    비용**이다: 미국 전 종목을 I/O 없이 판별하는 정적 집합은 없다(`popular-tickers` 등은 큐레이션
 *    일부라 롱테일 종목이 빠진다). 이미 페이지가 데운 종목은 24h Next 데이터 캐시 적중이지만,
 *    처음 보는 심볼은 이 조회가 DB를 거쳐 FMP/yahoo 프로필까지 갈 수 있다(`getBarsAction`이
 *    `resolveMarketProfileStatic`으로 치르는 것과 같은 비용). 이 조회가 `null`이거나 한국 주식·
 *    크립토·지수면 **aftermarket-trade와 quote 시세는 부르지 않는다** — "FMP에 안 간다"가 아니라
 *    "시세용 FMP 호출을 안 한다"가 정확하다.
 * 3. `quote:ext:<SYM>`(60s) read-through. 체결이 없거나 어긋난 결과(`null`)도 같은 TTL로 굳혀,
 *    유동성 없는 종목·장애 중인 FMP를 열린 탭 수만큼 두드리지 않는다. 장애는 최대 60초 동안
 *    "표시 없음"으로 굳는다(SERVER.md#DC-9의 의도된 선택).
 *    예외 — 체결 조회가 `QUOTE_LOOKUP_TIMEOUT_MS`(5초)를 넘기면 포기하고 `null`을 **10초만**
 *    굳힌다. 60초를 굳히면 방금 회복한 FMP를 1분간 가리고, 아예 안 굳히면 느린 FMP에 폴링마다
 *    새 재시도 체인(포기해도 백그라운드에서 계속 돈다)을 쌓는다. 10초면 회복은 곧 보이고 종목당
 *    시도는 분당 6회로 묶인다.
 *
 * 호출 주체는 사용자 입력이 한 번이라도 있었던 클라이언트뿐이다(`useExtendedHoursQuote`) —
 * SSR·ISR·prewarm 어디서도 부르지 않는다.
 */
export async function loadExtendedHoursQuote(
    symbol: unknown,
    now: Date = new Date()
): Promise<ExtendedHoursQuote | null> {
    if (isE2E()) return null;
    const window = extendedSessionAt(now);
    if (window === null) return null;

    if (typeof symbol !== 'string' || symbol.length > SYMBOL_MAX_LENGTH) {
        return null;
    }
    const ticker = symbol.toUpperCase();
    if (!SYMBOL_EDGE_RE.test(ticker)) return null;

    const asset = await getAssetInfoStatic(ticker);
    if (asset === null || marketProfileForAssetInfo(asset) !== 'us-equity') {
        return null;
    }
    const fmpSymbol = asset.fmpSymbol ?? ticker;
    // 지수(`^SPX`)에는 장외 체결이 없다.
    if (fmpSymbol.startsWith('^')) return null;

    // 시간 초과는 `null`로 굳히되 TTL을 짧게 한다(아래 JSDoc 3번). 값 하나에서 TTL을 고르는
    // `getOrSetCache`의 함수형 TTL에 시간 초과 여부를 넘기려고 클로저 플래그를 쓴다.
    let timedOut = false;
    return getOrSetCache<ExtendedHoursQuote | null>(
        buildExtendedQuoteKey(ticker),
        () =>
            timedOut
                ? EXTENDED_QUOTE_TIMEOUT_CACHE_TTL_SECONDS
                : EXTENDED_QUOTE_CACHE_TTL_SECONDS,
        async () => {
            const outcome = await fetchExtendedQuote(fmpSymbol, window, now);
            timedOut = outcome.timedOut;
            return outcome.value;
        },
        () => true,
        // 캐시 값은 60초만 산다. 그래도 세션이 바뀐 직후(프리→정규장→애프터)의 값은 쓰지 않는다.
        hit => hit === null || hit.session === window.kind
    );
}
