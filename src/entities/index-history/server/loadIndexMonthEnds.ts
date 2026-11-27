import 'server-only';
import type { AgentHistoryIndex, MonthEndClose } from '@y0ngha/siglens-core';
import { parseDailyCloseRows } from '@/entities/market-fear-greed/lib/parseFmpEodRows';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { toFiniteNumber } from '@/shared/api/fmp/toFiniteNumber';
import { getYahooClient } from '@/shared/api/yahoo/createYahooClient';
import { getOrSetCache } from '@/shared/cache/getOrSetCache';
import { SECONDS_PER_DAY, SECONDS_PER_HOUR } from '@/shared/config/time';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import { isRecord } from '@/shared/lib/isRecord';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';
import { foldDailyToMonthEnds } from '../lib/foldMonthEnds';
import { INDEX_SOURCES, type IndexSource } from '../lib/indexSources';

const yahooFinance = getYahooClient();

/**
 * FMP `historical-price-eod/light` 한 요청의 연도 폭. 한 요청은 약 5,000행에서 잘리고(오래된 행부터 빠진다), 1950년대에는
 * 토요일 거래가 있어 해마다 세션이 많았다 — 15년(최대 약 3,900세션)으로 여유를 둔다. 잘림은 아래 검사가 따로 잡는다.
 */
const FMP_CHUNK_YEARS = 15;
/** 구간의 첫 행이 요청 시작일에서 이만큼 넘게 늦으면 잘린 응답이다(연초 휴장·지수 시작일 여유). */
const CHUNK_START_SLACK_DAYS = 45;
/**
 * 동시에 보내는 구간 요청 수(SERVER.md#CC-1). 지금은 구간이 6개(1950년부터 15년씩)라 한 묶음이고, 15년마다 하나씩 늘어
 * 넘치면 다음 묶음으로 간다 — 그때 최악 시간이 묶음 수만큼 는다(아래 시간 예산 참고).
 */
const FMP_CHUNK_CONCURRENCY = 6;
/** 지난 달 값은 바뀌지 않는다. 키에 현재 달을 넣으므로 달이 바뀌면 새 키로 다시 읽는다. */
const MONTH_ENDS_CACHE_TTL_SECONDS = 32 * SECONDS_PER_DAY;
/**
 * 달이 바뀐 직후 며칠은 직전 달 마지막 세션의 종가가 아직 실리지 않았거나 잠정치일 수 있다 — 이 기간에 채운 값은 짧게
 * 두어 확정된 종가로 다시 읽게 한다.
 */
const MONTH_START_DAYS = 5;
const MONTH_START_TTL_SECONDS = 6 * SECONDS_PER_HOUR;

async function loadFmpChunk(
    source: IndexSource,
    from: string,
    to: string
): Promise<{ date: string; close: number }[]> {
    const page = await fmpGet<unknown>(
        'historical-price-eod/light',
        { symbol: source.symbol, from, to },
        // 재시도하지 않는다: 구간 요청은 동시에 나가므로 최악 시간은 요청 한 번(10초)이다. 기본 재시도(최대 3회 +
        // 백오프 60초)를 두면 도구 상한(core `TOOL_TIMEOUT_MS.cached` 30초)을 넘는다. 실패는 캐시되지 않고 다음 호출이
        // 다시 읽는다.
        { retryTransient: false }
    );
    if (!Array.isArray(page))
        throw new Error(`fmp ${source.symbol} history malformed`);
    const rows = parseDailyCloseRows(page, 'price');
    const earliest = rows.reduce<string | null>(
        (min, row) => (min === null || row.date < min ? row.date : min),
        null
    );
    // 지수가 시작하기 전 구간(나스닥 1971년 이전)은 첫 달을 기준으로 본다.
    const expectedStart =
        from < `${source.firstMonth}-01` ? `${source.firstMonth}-01` : from;
    if (
        earliest === null ||
        earliest > addUtcIsoDays(expectedStart, CHUNK_START_SLACK_DAYS)
    )
        throw new Error(
            `fmp ${source.symbol} chunk ${from} truncated (earliest ${earliest})`
        );
    return rows;
}

async function loadFmpMonthEnds(
    source: IndexSource,
    toYear: number
): Promise<MonthEndClose[]> {
    const startYear = Number(source.firstMonth.slice(0, 4));
    const chunks = Array.from(
        { length: Math.ceil((toYear - startYear + 1) / FMP_CHUNK_YEARS) },
        (_, i) => {
            const year = startYear + i * FMP_CHUNK_YEARS;
            return {
                from: `${year}-01-01`,
                to: `${Math.min(year + FMP_CHUNK_YEARS - 1, toYear)}-12-31`,
            };
        }
    );
    const settled = await withConcurrencyLimit(
        chunks,
        FMP_CHUNK_CONCURRENCY,
        chunk => loadFmpChunk(source, chunk.from, chunk.to)
    );
    const failed = settled.find(result => result.status === 'rejected');
    if (failed !== undefined) throw failed.reason;
    return foldDailyToMonthEnds(
        settled.flatMap(result =>
            result.status === 'fulfilled' ? result.value : []
        )
    );
}

async function loadYahooMonthEnds(
    source: IndexSource
): Promise<MonthEndClose[]> {
    const result = await yahooFinance.chart(
        source.symbol,
        { period1: `${source.firstMonth}-01`, interval: '1mo' },
        { validateResult: false }
    );
    const quotes: unknown = isRecord(result) ? result.quotes : undefined;
    if (!Array.isArray(quotes))
        throw new Error(`yahoo ${source.symbol} history malformed`);
    // 월봉의 `date`는 그 달 첫날 현지 자정이다(KST 자정 = UTC 전날 15시). 현지 달력 날짜로 바꾼 뒤 달마다 마지막 행
    // 하나로 접는다 — 최신 거래 시각이 찍힌 행이 따로 붙어 같은 달이 두 번 나오는 경우를 없앤다.
    return foldDailyToMonthEnds(
        quotes.flatMap(quote => {
            if (!isRecord(quote) || !(quote.date instanceof Date)) return [];
            const close = toFiniteNumber(quote.close);
            return close === null
                ? []
                : [{ date: zonedDate(quote.date, source.timeZone), close }];
        })
    );
}

interface IndexMonthEnds {
    monthEnds: MonthEndClose[];
    /** 거래소 시간대 기준 진행 중인 달(`YYYY-MM`). core가 이 달 이후를 통계에서 뺀다. */
    currentMonth: string;
    usCycle: boolean;
}

/**
 * 지수의 월말 종가(가격 지수, 배당 제외). 미국 지수는 FMP 일봉을 구간별로 받아 달마다 마지막 거래일로 접고, 한국 지수는
 * Yahoo 월봉을 같은 규칙으로 접는다. 진행 중인 달이 들어 있을 수 있다(core가 뺀다).
 *
 * 시간 예산(SERVER.md#CC-7): FMP 구간 요청은 재시도 없이 `FMP_CHUNK_CONCURRENCY`(6)개씩 보낸다 — 지금은 6개라 한 묶음, 최악
 * 10초다(묶음이 둘이 되면 20초). Yahoo 월봉은 요청 한 번이다 — core
 * `TOOL_TIMEOUT_MS.cached`(30초) 안이다. 같은 키의 동시 호출은 `getOrSetCache`가 한 요청으로 묶는다.
 *
 * 받은 이력이 알려진 첫 달에서 시작하지 않거나 FMP 구간 하나라도 잘렸으면 던진다 — 일부 연도가 빠진 이력을 한 달 동안
 * 캐시하면 연간 표가 경고 없이 짧아진다. 실패는 캐시에 남지 않는다(SERVER.md#SA-18). E2E fake 모드에서는 네트워크에
 * 나가지 않고 던진다.
 */
export async function loadIndexMonthEnds(
    index: AgentHistoryIndex,
    now: Date = new Date()
): Promise<IndexMonthEnds> {
    const source = INDEX_SOURCES[index];
    const today = zonedDate(now, source.timeZone);
    const currentMonth = today.slice(0, 7);
    if (isE2EFakeMode())
        throw new Error('index history is not available in E2E fake mode');
    const monthStart = Number(today.slice(8, 10)) <= MONTH_START_DAYS;
    const monthEnds = await getOrSetCache<MonthEndClose[]>(
        `index-history:month-ends:v1:${index}:${currentMonth}`,
        monthStart ? MONTH_START_TTL_SECONDS : MONTH_ENDS_CACHE_TTL_SECONDS,
        async () => {
            const rows =
                source.provider === 'fmp'
                    ? await loadFmpMonthEnds(
                          source,
                          Number(currentMonth.slice(0, 4))
                      )
                    : await loadYahooMonthEnds(source);
            const first = rows[0]?.month;
            if (first === undefined || first > source.firstMonth)
                throw new Error(
                    `${source.symbol} history starts at ${first ?? 'nothing'}, expected ${source.firstMonth}`
                );
            return rows;
        }
    );
    return { monthEnds, currentMonth, usCycle: source.usCycle };
}
