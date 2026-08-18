import 'server-only';
import { createYahooClient } from './createYahooClient';
import type {
    Bar,
    GetBarsOptions,
    MarketQuote,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { SiglensMarketProvider } from '@/shared/api/market/marketProvider.types';
import { MS_PER_SECOND, MS_PER_HOUR } from '@/shared/config/time';
import { pickYahooDisplayName } from './displayName';

const yahooFinance = createYahooClient();

/** KST는 서머타임이 없다 — ET와 달리 고정 오프셋이라 DST 분기가 필요 없다. */
const KST_OFFSET_HOURS = 9;

const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD"

/**
 * core `Timeframe` → yahoo chart interval.
 *
 * `4Hour`가 빠져 있는 것은 의도적이다 — yahoo chart의 interval enum에 4시간이 없다
 * (1m/2m/5m/15m/30m/60m/90m/1h/1d/5d/1wk/1mo/3mo). `KR_EQUITY_DESCRIPTOR`의
 * `allowedTimeframes`에서도 제외했으므로 정상 경로로는 도달하지 않지만,
 * 타입상 `Timeframe`은 여전히 `4Hour`를 포함하므로 `getBars`가 방어한다.
 */
const YAHOO_INTERVAL: Partial<
    Record<Timeframe, '5m' | '15m' | '30m' | '1h' | '1d'>
> = {
    '5Min': '5m',
    '15Min': '15m',
    '30Min': '30m',
    '1Hour': '1h',
    '1Day': '1d',
};

interface YahooChartQuote {
    date: Date;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
}

/**
 * yahoo가 간헐적으로 OHLCV가 `null`인 봉을 섞어 반환한다 — 2026-08-16 `005930.KS`
 * 실측에서 15분봉 405개 중 2개, 일봉 484개 중 1개가 `close: null`이었다. 그대로
 * 통과시키면 core의 지표 계산이 NaN으로 오염되므로 여기서 제거한다.
 *
 * `volume`만 `null`인 경우는 거래 없는 구간이므로 0으로 채워 봉 자체는 살린다.
 */
function toBar(raw: YahooChartQuote): Bar | null {
    const { open, high, low, close } = raw;
    if (open === null || high === null || low === null || close === null) {
        return null;
    }
    return {
        time: Math.floor(raw.date.getTime() / MS_PER_SECOND),
        open,
        high,
        low,
        close,
        volume: raw.volume ?? 0,
    };
}

/** 시각을 KST 벽시계 기준 거래일(YYYY-MM-DD)로 환산한다. */
function kstTradingDate(at: Date): string {
    const shifted = new Date(at.getTime() + KST_OFFSET_HOURS * MS_PER_HOUR);
    return shifted.toISOString().slice(0, ISO_DATE_LENGTH);
}

/** YYYY-MM-DD → UTC 자정 unix초. 일봉 `Bar.time` 규약(FMP 어댑터와 동일). */
function utcMidnightSeconds(isoDate: string): number {
    return Math.floor(Date.parse(isoDate + 'T00:00:00Z') / MS_PER_SECOND);
}

/**
 * yahoo-finance2 어댑터 — KOSPI/KOSDAQ(`005930.KS` / `247540.KQ`) 전용.
 *
 * FMP 어댑터와 달리 타임존 변환 로직이 거의 없다. yahoo `chart`가 이미 epoch 기반
 * `Date`를 돌려주고 KST는 서머타임이 없어, FMP 어댑터의 ET/DST 계산
 * (`getEtOffsetHours`, `nthSundayDay`)에 해당하는 코드가 전부 불필요하다.
 *
 * 에러 정책은 FMP 어댑터와 동일하게 맞춘다 — 봉 조회 실패는 전파(상위 캐시가 빈
 * 결과를 굳히지 않도록), 시세 조회 실패는 `null`로 degrade.
 */
export class YahooMarketProvider implements SiglensMarketProvider {
    async getBars(options: GetBarsOptions): Promise<Bar[]> {
        const interval = YAHOO_INTERVAL[options.timeframe];
        if (interval === undefined) {
            console.warn(
                '[YahooMarketProvider] unsupported timeframe:',
                options.timeframe
            );
            return [];
        }

        // `options.limit`은 FMP 어댑터와 같은 이유로 전달하지 않는다 — yahoo chart도
        // 개수가 아니라 기간(period1/period2)으로 범위를 정한다. 호출부가 날짜 창으로
        // 스코프를 잡는다(core `barsApi`가 timeframe별 lookback을 계산해 `from`을 채운다).
        const result = await yahooFinance.chart(options.symbol, {
            period1: options.from ?? this.defaultPeriod1(options.timeframe),
            ...(options.before !== undefined
                ? { period2: options.before }
                : {}),
            interval,
        });

        // Safe cast: 라이브러리의 `chart` 반환 타입은 interval에 따라 필드가 달라지는
        // 넓은 유니온이라 우리가 소비하는 부분집합과 구조적으로 대응하지 않는다.
        // `YahooChartQuote`는 OHLCV를 전부 nullable로 선언하고 `toBar`가 결측을
        // 걸러내므로, 실제 응답이 이 형상을 벗어나도 런타임에서 흡수된다.
        const quotes = result.quotes as unknown as YahooChartQuote[];
        return quotes.map(toBar).filter((bar): bar is Bar => bar !== null);
    }

    /**
     * `from` 없이 호출된 경우의 기간 하한. core `barsApi`는 항상 `from`을 채우지만
     * yahoo `chart`는 `period1`이 필수이므로 방어값이 필요하다. 일봉은 2년,
     * 인트라데이는 60일 — yahoo가 인트라데이에 두는 조회 한계와 같은 크기다.
     */
    private defaultPeriod1(timeframe: Timeframe): string {
        const days = timeframe === '1Day' ? 730 : 60;
        const from = new Date(Date.now() - days * 24 * MS_PER_HOUR);
        return from.toISOString().slice(0, ISO_DATE_LENGTH);
    }

    /**
     * **인프라 실패를 삼키지 않는 변형.** `null`은 오직 "그런 종목이 없다"만 뜻한다.
     *
     * `getQuote`는 두 가지를 모두 `null`로 접는다 — 호출부가 "미상장"과 "yahoo가 지금
     * 안 된다"를 구분할 수 없어, 장애 중에 실재하는 종목이 하드 404를 받는다. 미국 경로는
     * `throwOnInfraFailure: true`로 그 둘을 갈라 degrade 200 + noindex로 떨어뜨린다.
     */
    async getQuoteOrThrow(symbol: string): Promise<MarketQuote | null> {
        const q = await yahooFinance.quote(symbol);
        // 상장폐지/오타 심볼에 대해 yahoo는 throw가 아니라 `undefined`를 돌려준다
        // (실측: `999999.KS` → undefined). 옵셔널 체이닝 없이 접근하면 TypeError가 된다.
        if (!q || q.regularMarketPrice === undefined) return null;
        return {
            symbol,
            price: q.regularMarketPrice,
            changesPercentage: q.regularMarketChangePercent ?? 0,
            // 일부 KRX 종목은 사명 대신 코드 나열이 온다 — `displayName.ts` 참조.
            name: pickYahooDisplayName(symbol, q.longName, q.shortName),
        };
    }

    async getQuote(symbol: string): Promise<MarketQuote | null> {
        try {
            return await this.getQuoteOrThrow(symbol);
        } catch (error) {
            console.warn(
                '[YahooMarketProvider] getQuote failed:',
                symbol,
                error
            );
            return null;
        }
    }

    /**
     * 오늘(최근 거래일) 봉을 quote로 조회한다. EOD 캐시의 live tail 전용이며,
     * `CachedMarketDataProvider`가 `bars:today:<SYM>` 키로 별도 TTL을 건다.
     *
     * 날짜는 KST 벽시계 기준으로 뽑는다. 정규장(09:00~15:30 KST = 00:00~06:30 UTC)은
     * UTC 날짜와 KST 날짜가 같지만, 시간외 체결이나 지연된 `regularMarketTime`이
     * UTC 날짜 경계를 넘길 수 있어 KST로 명시 환산한다.
     */
    async getTodayBar(symbol: string): Promise<Bar | null> {
        try {
            const q = await yahooFinance.quote(symbol);
            if (!q || q.regularMarketPrice === undefined) return null;

            const at =
                q.regularMarketTime instanceof Date
                    ? q.regularMarketTime
                    : new Date();
            const close = q.regularMarketPrice;

            return {
                time: utcMidnightSeconds(kstTradingDate(at)),
                // 장 시작 전에는 open/high/low가 비어 올 수 있다 — 종가로 채워
                // 0으로 무너진 봉(지표를 크게 왜곡)이 생기지 않게 한다.
                open: q.regularMarketOpen ?? close,
                high: q.regularMarketDayHigh ?? close,
                low: q.regularMarketDayLow ?? close,
                close,
                volume: q.regularMarketVolume ?? 0,
            };
        } catch (error) {
            console.warn(
                '[YahooMarketProvider] today-quote fetch failed:',
                symbol,
                error
            );
            return null;
        }
    }
}
