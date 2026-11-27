import 'server-only';
import { getYahooClient } from './createYahooClient';
import { nonEmptyStringOrNull, toIsoOrNull } from './yahooValues';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { toFiniteNumber } from '@/shared/api/fmp/toFiniteNumber';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import {
    MS_PER_DAY,
    SECONDS_PER_HOUR,
    SECONDS_PER_MINUTE,
} from '@/shared/config/time';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';

const yahooFinance = getYahooClient();

const QUOTE_TTL_SECONDS = SECONDS_PER_MINUTE;
const DAILY_CLOSES_TTL_SECONDS = SECONDS_PER_HOUR;

/**
 * 일봉 조회 창. 1년 전 기준일(12개월 전 이전 마지막 거래일)이 주말·휴일에 걸려도
 * 직전 거래일을 찾을 수 있도록 365일에 여유를 둔다.
 */
const DAILY_LOOKBACK_DAYS = 400;

/**
 * 한 호출에서 같은 윈도 안에 캐시 miss가 난 심볼을 모아 `quote` 한 번으로 보내는 대기 시간.
 * 심볼별 캐시 읽기는 병렬로 나가 거의 같은 시점에 끝나므로 짧은 창이면 한 묶음이 된다. 묶음을 놓친
 * 심볼은 다음 묶음으로 나갈 뿐 틀린 값이 되지는 않는다.
 */
const QUOTE_BATCH_WINDOW_MS = 10;

const FALLBACK_TIME_ZONE = 'UTC';

export interface YahooMacroQuote {
    name: string | null;
    price: number;
    changePct: number | null;
    currency: string | null;
    delayMinutes: number | null;
    /** 시세 시각 ISO. */
    timeIso: string | null;
    quoteType: string | null;
    /** 선물 만기일 ISO(`quote.expireIsoDate`). 선물이 아니면 `null`. */
    contractExpiryIso: string | null;
}

export interface YahooDailyClose {
    /** 거래소 현지 달력 날짜(`timeZone` 기준) `YYYY-MM-DD`. */
    date: string;
    close: number;
    high: number | null;
    low: number | null;
}

/**
 * 일봉과, 그 날짜를 읽은 거래소 시간대. 시세의 달력 날짜도 같은 시간대로 읽어야 기준일 산식이 어긋나지 않는다.
 */
export interface YahooMacroDaily {
    timeZone: string;
    rows: YahooDailyClose[];
}

/** 원 quote → 캐시 가능한 DTO. 가격이 유한한 숫자가 아니면 `null`(시세 없음). */
export function mapMacroQuote(raw: unknown): YahooMacroQuote | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    const price = toFiniteNumber(r.regularMarketPrice);
    if (price === null) return null;
    return {
        name: nonEmptyStringOrNull(r.shortName),
        price,
        changePct: toFiniteNumber(r.regularMarketChangePercent),
        currency: nonEmptyStringOrNull(r.currency),
        delayMinutes: toFiniteNumber(r.exchangeDataDelayedBy),
        timeIso: toIsoOrNull(r.regularMarketTime),
        quoteType: nonEmptyStringOrNull(r.quoteType),
        contractExpiryIso: toIsoOrNull(r.expireIsoDate),
    };
}

/** 알 수 없는 시간대 이름이면 `Intl`이 던지므로 UTC로 내린다. */
function resolvedTimeZone(raw: unknown): string {
    const name = nonEmptyStringOrNull(raw);
    if (name === null) return FALLBACK_TIME_ZONE;
    try {
        zonedDate(new Date(0), name);
        return name;
    } catch {
        return FALLBACK_TIME_ZONE;
    }
}

/**
 * 원 chart 응답 → 오래된 순 일봉. 종가가 없는 행은 버린다.
 *
 * 날짜는 **차트의 거래소 시간대**(`meta.exchangeTimezoneName`)의 달력 날짜다. Yahoo는 FX 일봉을 거래소 현지
 * 자정에 찍는데(Europe/London은 서머타임에 전날 23:00 UTC) UTC 날짜로 자르면 여름 내내 모든 FX 봉이 하루
 * 이르게 표시된다.
 */
export function mapDailyCloses(raw: unknown): YahooMacroDaily {
    const record = (typeof raw === 'object' && raw !== null ? raw : {}) as {
        meta?: { exchangeTimezoneName?: unknown };
        quotes?: unknown;
    };
    const timeZone = resolvedTimeZone(record.meta?.exchangeTimezoneName);
    const quotes: unknown[] = Array.isArray(record.quotes) ? record.quotes : [];
    const rows = quotes.flatMap((item): YahooDailyClose[] => {
        if (typeof item !== 'object' || item === null) return [];
        // Safe cast: 바로 위에서 null이 아닌 object임을 확인했고, 아래에서 필드마다 좁혀 읽는다.
        const q = item as Record<string, unknown>;
        const close = toFiniteNumber(q.close);
        const iso = toIsoOrNull(q.date);
        if (close === null || iso === null) return [];
        return [
            {
                date: zonedDate(new Date(iso), timeZone),
                close,
                high: toFiniteNumber(q.high),
                low: toFiniteNumber(q.low),
            },
        ];
    });
    return {
        timeZone,
        rows: rows.toSorted((a, b) => a.date.localeCompare(b.date)),
    };
}

interface QuoteWaiter {
    resolve: (quote: YahooMacroQuote) => void;
    reject: (error: unknown) => void;
}

/**
 * 한 번의 `getYahooMacroQuotes` 호출 안에서 캐시 miss 심볼을 모아 `quote([...])` 한 번으로 보낸다.
 * 응답에 없는(또는 가격이 없는) 심볼은 그 심볼만 reject해 캐시에 남지 않고 `found: false`로 내려가며,
 * 묶음 호출 자체가 실패하면 이번 묶음의 모든 심볼이 reject된다.
 *
 * 배처는 **호출마다 새로 만든다** — 서로 다른 `getYahooMacroQuotes` 호출(다른 요청·다른 턴)의 심볼은 한
 * 묶음으로 합쳐지지 않는다. 호출 사이에 공유하면 한 요청의 실패가 다른 요청의 심볼까지 reject한다.
 */
function createQuoteBatcher() {
    const waiters = new Map<string, QuoteWaiter>();
    // 디바운스 상태: "묶음 창이 열려 있는가"를 타이머 핸들 하나로 든다. 창이 닫힐 때(`flush`) 비우고 다음
    // miss가 다시 연다 — 이 상태 전이가 배처의 본체라 불변 값으로 바꿀 수 없다.
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function flush(): Promise<void> {
        const batch = [...waiters];
        waiters.clear();
        timer = undefined;
        try {
            const raw: unknown = await yahooFinance.quote(
                batch.map(([symbol]) => symbol),
                {},
                { validateResult: false }
            );
            const items: unknown[] = Array.isArray(raw) ? raw : [raw];
            const bySymbol = new Map(
                items.flatMap((item): [string, unknown][] => {
                    // Safe cast: 필드 하나만 읽고 바로 `typeof`로 좁힌다(응답 타입은 라이브러리가 넓게 정의한다).
                    const symbol = (item as { symbol?: unknown } | null)
                        ?.symbol;
                    return typeof symbol === 'string'
                        ? [[symbol.toUpperCase(), item]]
                        : [];
                })
            );
            batch.forEach(([symbol, waiter]) => {
                const quote = mapMacroQuote(bySymbol.get(symbol.toUpperCase()));
                if (quote === null)
                    waiter.reject(new Error('yahoo macro quote missing'));
                else waiter.resolve(quote);
            });
        } catch (error) {
            batch.forEach(([, waiter]) => waiter.reject(error));
        }
    }

    return (symbol: string): Promise<YahooMacroQuote> =>
        new Promise((resolve, reject) => {
            waiters.set(symbol, { resolve, reject });
            timer ??= setTimeout(() => void flush(), QUOTE_BATCH_WINDOW_MS);
        });
}

/**
 * 선물·지수·환율 시세 여럿. 심볼마다 60초로 캐시하고, 캐시에 없는 심볼만 `quote` 한 번에 묶어 보낸다.
 * 실패(네트워크·응답에 없음·가격 없음)는 캐시하지 않고 로그 후 그 심볼만 `null`이다 — 한 심볼이
 * 빠져도 나머지는 살아 있다. 선물 시세는 10분 지연이다(`delayMinutes`).
 */
export async function getYahooMacroQuotes(
    yahooSymbols: readonly string[]
): Promise<Map<string, YahooMacroQuote | null>> {
    const unique = [...new Set(yahooSymbols)];
    if (isE2EFakeMode()) return new Map(unique.map(s => [s, null]));
    const fetchBatched = createQuoteBatcher();
    const entries = await Promise.all(
        unique.map(
            async (symbol): Promise<[string, YahooMacroQuote | null]> => {
                try {
                    return [
                        symbol,
                        await getOrSetCache<YahooMacroQuote>(
                            `yahoo:macro-quote:v1:${symbol}`,
                            QUOTE_TTL_SECONDS,
                            () => fetchBatched(symbol)
                        ),
                    ];
                } catch (error) {
                    console.warn(
                        '[yahooMacro] quote failed',
                        symbol,
                        redactDbErrorForLog(error)
                    );
                    return [symbol, null];
                }
            }
        )
    );
    return new Map(entries);
}

/**
 * 최근 ~400일 일봉(오래된 순)과 그 날짜의 시간대. 실패나 빈 응답은 캐시하지 않고 `null`이다 —
 * 호출부는 시세만 돌려주고 변화율·52주 범위를 `null`로 둔다.
 */
export async function getYahooMacroDailyCloses(
    yahooSymbol: string
): Promise<YahooMacroDaily | null> {
    if (isE2EFakeMode()) return null;
    try {
        return await getOrSetCache<YahooMacroDaily>(
            // v2: 날짜가 UTC 자르기에서 거래소 시간대 기준으로 바뀌었고 값에 시간대가 붙었다.
            `yahoo:macro-daily:v2:${yahooSymbol}`,
            DAILY_CLOSES_TTL_SECONDS,
            async () => {
                const now = Date.now();
                const daily = mapDailyCloses(
                    await yahooFinance.chart(
                        yahooSymbol,
                        {
                            period1: new Date(
                                now - DAILY_LOOKBACK_DAYS * MS_PER_DAY
                            ),
                            period2: new Date(now),
                            interval: '1d',
                        },
                        { validateResult: false }
                    )
                );
                if (daily.rows.length === 0)
                    throw new Error('yahoo macro daily closes empty');
                return daily;
            }
        );
    } catch (error) {
        console.warn(
            '[yahooMacro] daily closes failed',
            yahooSymbol,
            redactDbErrorForLog(error)
        );
        return null;
    }
}
