import type {
    GetBarsOptions,
    Bar,
    MarketQuote,
    Timeframe,
} from '@y0ngha/siglens-core';
import type {
    ExtendedHoursTrade,
    QuoteSnapshot,
    SiglensMarketProvider,
} from '@/shared/api/market/marketProvider.types';
import { MS_PER_SECOND, MS_PER_HOUR } from '@/shared/config/time';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import {
    MARCH,
    NOVEMBER,
    SECOND_SUNDAY,
    FIRST_SUNDAY,
    EDT_OFFSET_HOURS,
    EST_OFFSET_HOURS,
    nthSundayDay,
    getEasternOffsetHours,
} from '@/shared/lib/eastern';
import { mapOrNull } from '@/shared/api/market/mapOrNull';

const ISO_DATE_PREFIX_LENGTH = 10; // "YYYY-MM-DD"

/**
 * FMP가 미국 상장 종목의 인트라데이 시각 문자열과 `from`/`to` 날짜를 해석하는 타임존.
 * 아래 `fmpIntradayDateToUtcSeconds`가 모든 인트라데이 시각을 이 타임존으로 읽는다 —
 * 캐시 계층(`CachedMarketDataProvider`)이 같은 날짜 경계로 히스토리와 오늘 tail을 나눈다.
 */
export const FMP_EXCHANGE_TIME_ZONE = 'America/New_York';
const ISO_DATE_PART_INDEX = 0;

// FMP ET→UTC timestamp conversion. Canonical home after the market-provider
// ejection: siglens-core no longer fetches market data (it owns only the
// MarketDataProvider port), so this logic permanently lives in siglens.
//
// DST 날짜 계산은 eastern.ts의 nthSundayDay를 정규 원시 함수로 위임한다.
// FMP API 날짜 문자열은 1-indexed month이므로 0-indexed(MARCH=2, NOVEMBER=10)로 변환해 전달한다.

const FMP_DATETIME_YEAR_END = 4;
const FMP_DATETIME_MONTH_START = 5;
const FMP_DATETIME_MONTH_END = 7;
const FMP_DATETIME_DAY_START = 8;
const FMP_DATETIME_DAY_END = 10;
const FMP_DATETIME_HOUR_START = 11;
const FMP_DATETIME_HOUR_END = 13;
const FMP_DATETIME_MINUTE_START = 14;
const FMP_DATETIME_MINUTE_END = 16;
const FMP_DATETIME_SECOND_START = 17;
const FMP_DATETIME_SECOND_END = 19;

/**
 * FMP 날짜 문자열의 연도·1-indexed 월·일을 받아 ET UTC 오프셋을 반환한다.
 *
 * date-only 비교: FMP 장중 데이터의 시각은 04:00(확장 세션 포함)~20:00 ET 안에 있고
 * DST 전환 기준 시각(02:00 ET)보다 늦으므로 날짜 단위 비교로 오프셋을 정확히 결정할 수 있다.
 * hour 인수를 받지 않는 이 설계는 의도적이며 기존 동작을 보존한다.
 *
 * @param year  - 연도
 * @param month - 1-indexed 월 (FMP 날짜 문자열 원본 값)
 * @param day   - day-of-month
 * @returns EDT(-4) 또는 EST(-5)
 */
function getEtOffsetHours(year: number, month: number, day: number): number {
    // nthSundayDay는 0-indexed month를 받으므로 MARCH(2), NOVEMBER(10)을 직접 사용
    const springDay = nthSundayDay(year, MARCH, SECOND_SUNDAY);
    const fallDay = nthSundayDay(year, NOVEMBER, FIRST_SUNDAY);

    const dateMs = Date.UTC(year, month - 1, day);
    const springMs = Date.UTC(year, MARCH, springDay);
    const fallMs = Date.UTC(year, NOVEMBER, fallDay);

    return dateMs >= springMs && dateMs < fallMs
        ? EDT_OFFSET_HOURS
        : EST_OFFSET_HOURS;
}

function fmpIntradayDateToUtcSeconds(dateStr: string): number {
    const year = Number(dateStr.substring(0, FMP_DATETIME_YEAR_END));
    const month = Number(
        dateStr.substring(FMP_DATETIME_MONTH_START, FMP_DATETIME_MONTH_END)
    );
    const day = Number(
        dateStr.substring(FMP_DATETIME_DAY_START, FMP_DATETIME_DAY_END)
    );
    const hour = Number(
        dateStr.substring(FMP_DATETIME_HOUR_START, FMP_DATETIME_HOUR_END)
    );
    const minute = Number(
        dateStr.substring(FMP_DATETIME_MINUTE_START, FMP_DATETIME_MINUTE_END)
    );
    const second = Number(
        dateStr.substring(FMP_DATETIME_SECOND_START, FMP_DATETIME_SECOND_END)
    );
    const etOffsetHours = getEtOffsetHours(year, month, day);
    const utcMs = Date.UTC(
        year,
        month - 1,
        day,
        hour - etOffsetHours,
        minute,
        second
    );
    return Math.floor(utcMs / MS_PER_SECOND);
}

const FMP_INTRADAY_TIMEFRAME_MAP: Record<Exclude<Timeframe, '1Day'>, string> = {
    '5Min': '5min',
    '15Min': '15min',
    '30Min': '30min',
    '1Hour': '1hour',
    '4Hour': '4hour',
};

interface FmpOhlcvBar {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}
interface FmpQuote {
    price: number;
    open: number;
    dayHigh: number;
    dayLow: number;
    volume: number;
    timestamp: number;
    changePercentage: number;
    name: string;
}

/** FMP `aftermarket-trade` 행. 필드가 비어 올 수 있어 전부 `unknown`으로 받아 검증한다. */
interface FmpAftermarketTradeRow {
    price?: unknown;
    tradeSize?: unknown;
    timestamp?: unknown;
}

/**
 * `aftermarket-trade` 응답 → 마지막 체결. 비배열·빈 배열·가격/시각이 유한한 양수가 아닌
 * 행은 `null`이다(표시할 근거가 없으면 아무것도 보이지 않는 편이 낫다). `tradeSize`는
 * 표시에 쓰지 않으므로 깨져 있어도 0으로 둔다.
 */
export function parseAftermarketTrade(raw: unknown): ExtendedHoursTrade | null {
    if (!Array.isArray(raw)) return null;
    // 빈 배열이면 `raw[0]`이 `undefined`라 아래 검사에서 같이 걸러진다.
    const row = raw[0] as FmpAftermarketTradeRow | null | undefined;
    if (row === null || typeof row !== 'object') return null;
    const { price, tradeSize, timestamp } = row;
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
        return null;
    }
    if (
        typeof timestamp !== 'number' ||
        !Number.isFinite(timestamp) ||
        timestamp <= 0
    ) {
        return null;
    }
    return {
        price,
        tradeSize:
            typeof tradeSize === 'number' && Number.isFinite(tradeSize)
                ? tradeSize
                : 0,
        timestampMs: timestamp,
    };
}

function toFmpBar(raw: FmpOhlcvBar): Bar {
    return {
        time: fmpIntradayDateToUtcSeconds(raw.date),
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume,
    };
}

function toFmpDailyBar(raw: FmpOhlcvBar): Bar {
    // UTC midnight (Z): deterministic regardless of server TZ and consistent with the
    // intraday path's ET→UTC conversion. (lightweight-charts expects UTC.)
    return {
        time: Math.floor(
            new Date(raw.date + 'T00:00:00Z').getTime() / MS_PER_SECOND
        ),
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: raw.volume,
    };
}

function buildBarsQuery(
    symbol: string,
    fromDate: string | undefined,
    endDate: string | undefined,
    extended = false
): Record<string, string> {
    return {
        symbol,
        ...(fromDate !== undefined ? { from: fromDate } : {}),
        ...(endDate !== undefined ? { to: endDate } : {}),
        // 프리·애프터마켓 포함(04:00~20:00 ET). 인트라데이에만 의미가 있다 — 일봉 엔드포인트는
        // 이 인자를 무시한다(2026-10-14 실측). 기본값 `false`는 쿼리에 아무것도 더하지 않아
        // 기존 정규장 요청의 URL을 바꾸지 않는다.
        ...(extended ? { extended: 'true' } : {}),
    };
}

function toFmpMarketQuote(symbol: string, quote: FmpQuote): MarketQuote {
    return {
        symbol,
        price: quote.price,
        changesPercentage: quote.changePercentage,
        name: quote.name ?? symbol,
        // core `MarketQuote.timestamp` — the raw FMP row already carries this
        // (also used by `toFmpTodayBar`), just not previously passed through.
        ...(Number.isFinite(quote.timestamp)
            ? { timestamp: quote.timestamp }
            : {}),
    };
}

function toFmpTodayBar(quote: FmpQuote): Bar {
    // Derive the ET-local trading date from the quote timestamp.
    // UTC toISOString() would cross to the next calendar day after ~19:00 EST
    // (or ~20:00 EDT) for after-hours trades — producing a wrong +1 day date.
    // Shift by the ET offset first so getUTCDate/Month/FullYear reflect wall-clock ET.
    const quoteMs = quote.timestamp * MS_PER_SECOND;
    const etDate = new Date(
        quoteMs + getEasternOffsetHours(new Date(quoteMs)) * MS_PER_HOUR
    );
    const dateStr = etDate.toISOString().split('T')[ISO_DATE_PART_INDEX]!;
    return {
        time: Math.floor(
            new Date(dateStr + 'T00:00:00Z').getTime() / MS_PER_SECOND
        ),
        open: quote.open,
        high: quote.dayHigh,
        low: quote.dayLow,
        close: quote.price,
        volume: quote.volume,
    };
}

/**
 * FMP adapter for the core `MarketDataProvider` port. Fetches bars/quotes via
 * the shared `fmpGet` HTTP client (retry + structured FmpHttpError). Quote
 * failures degrade to `null`; bar failures propagate (after fmpGet's retries).
 */
export class FmpMarketProvider implements SiglensMarketProvider {
    async getBars(options: GetBarsOptions): Promise<Bar[]> {
        // `options.limit` is intentionally not forwarded: this adapter bounds
        // results by the `from`/`before` date window, because the FMP historical
        // endpoints used here (`historical-chart/*`, `historical-price-eod/full`)
        // are date-ranged, not count-limited. Callers must scope by date window.
        const { symbol, timeframe, before, from } = options;
        const fromDate = from?.substring(0, ISO_DATE_PREFIX_LENGTH);
        const endDate = before?.substring(0, ISO_DATE_PREFIX_LENGTH);

        if (timeframe === '1Day') {
            return this.getDailyBars(symbol, fromDate, endDate);
        }
        // Safe: the '1Day' branch returned above, so timeframe is guaranteed non-'1Day' here.
        return this.getIntradayBars(
            symbol,
            timeframe as Exclude<Timeframe, '1Day'>,
            fromDate,
            endDate,
            false
        );
    }

    /**
     * 프리·애프터마켓을 포함한 **인트라데이** 봉(`extended=true`, 04:00~20:00 ET).
     *
     * `getBars`와 별개 메서드다 — `getBars`(차트·지표·분석·섹터 스캔·SEO가 쓰는 정규장 봉)의
     * 요청 URL·결과는 이 메서드가 있어도 한 글자도 바뀌지 않는다. 확장 봉은 표시 전용 계통이라
     * 지표·분석에 섞지 않는다(`extendedBarsDisplayOnly` 가드).
     *
     * 1Day는 `extended`를 무시하므로(실측) 빈 배열을 돌려, 일봉 경로에 이 메서드를 쓰는 실수를
     * 호출 비용 없이 막는다. 1시간·4시간 버킷은 시계 정각에 정렬돼 정규장을 가로지르므로 원본
     * 그대로 돌려주고, 정규장과의 정리는 `extendedBarsSession`이 맡는다.
     */
    async getExtendedBars(options: GetBarsOptions): Promise<Bar[]> {
        const { symbol, timeframe, before, from } = options;
        if (timeframe === '1Day') return [];
        return this.getIntradayBars(
            symbol,
            timeframe as Exclude<Timeframe, '1Day'>,
            from?.substring(0, ISO_DATE_PREFIX_LENGTH),
            before?.substring(0, ISO_DATE_PREFIX_LENGTH),
            true
        );
    }

    private async getIntradayBars(
        symbol: string,
        timeframe: Exclude<Timeframe, '1Day'>,
        fromDate: string | undefined,
        endDate: string | undefined,
        extended: boolean
    ): Promise<Bar[]> {
        const raw = await fmpGet<FmpOhlcvBar[]>(
            `historical-chart/${FMP_INTRADAY_TIMEFRAME_MAP[timeframe]}`,
            buildBarsQuery(symbol, fromDate, endDate, extended)
        );
        if (!Array.isArray(raw)) return [];
        return raw.map(r => toFmpBar(r)).toReversed();
    }

    private async getDailyBars(
        symbol: string,
        fromDate: string | undefined,
        endDate: string | undefined
    ): Promise<Bar[]> {
        const [raw, todayBar] = await Promise.all([
            fmpGet<FmpOhlcvBar[]>(
                'historical-price-eod/full',
                buildBarsQuery(symbol, fromDate, endDate)
            ),
            endDate === undefined
                ? this.getTodayBar(symbol)
                : Promise.resolve(null),
        ]);
        if (!Array.isArray(raw)) return [];
        const eodBars = raw.map(r => toFmpDailyBar(r)).toReversed();
        if (todayBar === null) return eodBars;
        const lastBar = eodBars.at(-1);
        if (lastBar !== undefined && lastBar.time >= todayBar.time)
            return eodBars;
        return [...eodBars, todayBar];
    }

    async getQuote(symbol: string): Promise<MarketQuote | null> {
        return (await this.getQuoteSnapshot(symbol)).quote;
    }

    /** 오늘(최근 거래일) 봉을 /quote로 조회한다(OHLCV). EOD 캐시의 live tail 전용. */
    async getTodayBar(symbol: string): Promise<Bar | null> {
        return (await this.getQuoteSnapshot(symbol)).todayBar;
    }

    /**
     * 프리·애프터마켓 마지막 체결(`/aftermarket-trade`) — **표시 전용**.
     *
     * `/quote`는 정규장에만 갱신되므로(2026-10-15 실측) 확장 세션 가격은 이 엔드포인트가 유일한
     * 출처다. 결과를 봉·`todayBar`·지표·분석에 섞지 않는다(`getQuoteSnapshot`과 별개 계통).
     * `aftermarket-quote`(호가·거래량)는 한 줄 표시에 쓰이는 값이 없어 부르지 않는다 —
     * 호출마다 FMP 대역폭이 든다. 배치 변형(`batch-aftermarket-*`)은 Starter 플랜에서 402다.
     *
     * 조회 예외·빈/깨진 응답은 경고 후 `null`(조용히 아무것도 안 그린다).
     */
    async getExtendedHoursTrade(
        symbol: string
    ): Promise<ExtendedHoursTrade | null> {
        let raw: unknown;
        try {
            raw = await fmpGet<unknown>('aftermarket-trade', { symbol });
        } catch (error) {
            console.warn(
                '[FmpMarketProvider] aftermarket trade fetch failed:',
                symbol,
                error
            );
            return null;
        }
        return parseAftermarketTrade(raw);
    }

    /**
     * `/quote` 한 번으로 시세와 오늘 봉을 함께 만든다. 예전에는 `getQuote`와
     * `getTodayBar`가 같은 엔드포인트를 각각 불렀다.
     *
     * 실패 의미는 둘 다 기존과 같다 — 조회 예외·빈/비배열 응답은 경고 로그 후 둘 다 `null`.
     * 두 매핑은 서로 독립이라 한쪽 매핑이 던져도(예: 비정상 timestamp로 봉 날짜 계산 실패)
     * 다른 쪽은 살린다.
     */
    async getQuoteSnapshot(symbol: string): Promise<QuoteSnapshot> {
        let raw: FmpQuote[];
        try {
            raw = await fmpGet<FmpQuote[]>('quote', { symbol });
        } catch (error) {
            console.warn(
                '[FmpMarketProvider] quote snapshot fetch failed:',
                symbol,
                error
            );
            return { quote: null, todayBar: null };
        }
        if (!Array.isArray(raw) || raw.length === 0) {
            return { quote: null, todayBar: null };
        }
        const row = raw[0]!;
        return {
            quote: mapOrNull('FmpMarketProvider', 'getQuote', symbol, () =>
                toFmpMarketQuote(symbol, row)
            ),
            todayBar: mapOrNull(
                'FmpMarketProvider',
                'today-quote',
                symbol,
                () => toFmpTodayBar(row)
            ),
        };
    }
}
