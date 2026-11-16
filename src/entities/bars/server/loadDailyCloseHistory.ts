import 'server-only';
import type { MarketDailyClose, MarketSessionSpec } from '@y0ngha/siglens-core';
import { parseDailyCloseRows } from '@/entities/market-fear-greed/lib/parseFmpEodRows';
import { isE2EFakeMode } from '@/shared/api/e2eEnv';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import { toFiniteNumber } from '@/shared/api/fmp/toFiniteNumber';
import { getYahooClient } from '@/shared/api/yahoo/createYahooClient';
import { addUtcIsoDays } from '@/shared/lib/isoDate';
import { isRecord } from '@/shared/lib/isRecord';
import {
    lastClosedSessionDate,
    zonedDate,
} from '@/shared/lib/marketSessionDate';
import { withConcurrencyLimit } from '@/shared/lib/withConcurrencyLimit';

const yahooFinance = getYahooClient();

/** 가장 이른 요청 연도. 미국 종목 대부분의 상장 이력을 덮는다(FMP는 그 전 이력이 있어도 여기서 자른다). */
const DAILY_HISTORY_FIRST_YEAR = 1970;
/**
 * FMP `historical-price-eod/light` 한 요청의 연도 폭. 한 요청은 5,000행에서 잘린다(실측 2026-11-17: QQQ 1990~2026 요청이
 * 2007-01-03부터 5,000행) — 365일 거래하는 크립토도 10년이면 약 3,650행이라 여유가 있다. 잘림은 아래 검사가 따로 잡는다.
 */
const FMP_CHUNK_YEARS = 10;
/** FMP 한 요청의 행 상한. 받은 원본 행이 이만큼이면 잘린 응답으로 본다. */
const FMP_ROW_CAP = 5000;
/** 앞 구간에 이력이 있는데 이 구간의 첫 행이 요청 시작일보다 이만큼 넘게 늦으면 빠진 구간으로 본다(연초 휴장 여유). */
const CHUNK_START_SLACK_DAYS = 45;
/** Yahoo 일봉 이력 시작일. Yahoo는 한 요청에 전체 일봉을 준다. */
const YAHOO_PERIOD_START = `${DAILY_HISTORY_FIRST_YEAR}-01-01`;

export type DailyHistorySource = 'fmp' | 'yahoo';

interface FmpChunk {
    from: string;
    to: string;
}

interface LoadedChunk {
    chunk: FmpChunk;
    rows: MarketDailyClose[];
}

async function loadFmpChunk(
    symbol: string,
    chunk: FmpChunk
): Promise<LoadedChunk> {
    const page = await fmpGet<unknown>(
        'historical-price-eod/light',
        { symbol, from: chunk.from, to: chunk.to },
        // 재시도하지 않는다: 구간 요청은 동시에 나가므로 최악 시간은 요청 한 번(10초)이다. 기본 재시도(최대 3회 + 백오프)를
        // 두면 도구 상한(30초)을 넘는다. 실패는 캐시되지 않고 다음 호출이 다시 읽는다.
        { retryTransient: false }
    );
    if (!Array.isArray(page))
        throw new Error(`fmp ${symbol} history malformed`);
    // 상한은 파싱 전 원본 행 수로 본다 — 버려지는 행이 몇 개 섞인 잘린 응답도 잡는다.
    if (page.length >= FMP_ROW_CAP)
        throw new Error(`fmp ${symbol} chunk ${chunk.from} hit the row cap`);
    return { chunk, rows: parseDailyCloseRows(page, 'price') };
}

function earliestDate(rows: readonly MarketDailyClose[]): string | null {
    return rows.reduce<string | null>(
        (min, row) => (min === null || row.date < min ? row.date : min),
        null
    );
}

/** 상장 전 구간은 비어 있다. 첫 비어 있지 않은 구간 뒤로는 모든 구간이 시작일 근처에서 시작해야 한다. */
function startsLate(loaded: LoadedChunk): boolean {
    const earliest = earliestDate(loaded.rows);
    return (
        earliest === null ||
        earliest > addUtcIsoDays(loaded.chunk.from, CHUNK_START_SLACK_DAYS)
    );
}

async function loadFmpHistory(
    symbol: string,
    lastClosed: string
): Promise<MarketDailyClose[]> {
    const toYear = Number(lastClosed.slice(0, 4));
    const chunks: FmpChunk[] = Array.from(
        {
            length: Math.ceil(
                (toYear - DAILY_HISTORY_FIRST_YEAR + 1) / FMP_CHUNK_YEARS
            ),
        },
        (_, i) => {
            const year = DAILY_HISTORY_FIRST_YEAR + i * FMP_CHUNK_YEARS;
            const end = year + FMP_CHUNK_YEARS - 1;
            // 마지막 구간은 마지막 마감 세션에서 끝낸다 — `to`가 미래면 FMP가 진행 중인 세션 행을 실시간 가격으로 준다.
            return {
                from: `${year}-01-01`,
                to: end >= toYear ? lastClosed : `${end}-12-31`,
            };
        }
    );
    // 구간 수만큼 한 번에 보낸다(SERVER.md#CC-1의 상한 = 구간 수, 1970년부터 10년씩이라 지금 6개, 10년마다 하나 는다) —
    // 묶음이 둘로 나뉘어 최악 시간이 두 배가 되는 일이 없다.
    const settled = await withConcurrencyLimit(chunks, chunks.length, chunk =>
        loadFmpChunk(symbol, chunk)
    );
    const failed = settled.find(result => result.status === 'rejected');
    if (failed !== undefined) throw failed.reason;
    const loaded = settled.flatMap(result =>
        result.status === 'fulfilled' ? [result.value] : []
    );
    // 빠진 몇 년이 하락 구간 하나를 통째로 지운다 — 중간이 빈 응답은 실패로 본다.
    const firstListed = loaded.findIndex(item => item.rows.length > 0);
    const gap =
        firstListed === -1
            ? undefined
            : loaded.slice(firstListed + 1).find(startsLate);
    if (gap !== undefined)
        throw new Error(`fmp ${symbol} chunk ${gap.chunk.from} has a gap`);
    return loaded.flatMap(item => item.rows);
}

async function loadYahooHistory(
    symbol: string,
    timeZone: string
): Promise<MarketDailyClose[]> {
    const result = await yahooFinance.chart(
        symbol,
        { period1: YAHOO_PERIOD_START, interval: '1d' },
        { validateResult: false }
    );
    const quotes: unknown = isRecord(result) ? result.quotes : undefined;
    if (!Array.isArray(quotes))
        throw new Error(`yahoo ${symbol} history malformed`);
    // `close`는 분할 반영 가격이다. 배당까지 반영한 `adjclose`는 쓰지 않는다 — 도구가 가격 기준(배당 제외)이라고 말한다.
    return quotes.flatMap(quote => {
        if (!isRecord(quote) || !(quote.date instanceof Date)) return [];
        const close = toFiniteNumber(quote.close);
        return close === null || close <= 0
            ? []
            : [{ date: zonedDate(quote.date, timeZone), close }];
    });
}

/**
 * 한 종목의 **완결된** 일봉 종가 전체 이력(가격 기준, 배당 제외, 거래소 현지 날짜, 오래된 순). 미국·크립토는 FMP 일봉을
 * 1970년부터 10년 구간으로 받고, 한국 종목은 Yahoo 일봉을 한 번에 받는다. 마지막 마감 세션(`lastClosedSessionDate`, EOD
 * 게시 여유 포함 — 크립토는 어제 UTC) 뒤의 행은 진행 중이거나 아직 확정되지 않은 값이라 뺀다. 이력이 없는 종목은 빈 배열이다.
 *
 * 시간 예산(SERVER.md#CC-7): FMP 구간은 재시도 없이 전부 동시에 보낸다 — 최악 10초. Yahoo는 요청 한 번(최악 10초)이다.
 * 실행기 쪽 자산 조회·Redis 왕복을 더해도 core `TOOL_TIMEOUT_MS.cached`(30초) 안이다.
 *
 * 구간 하나라도 실패하거나 잘렸거나 중간이 빠졌으면 던진다(메시지에 구간 시작일) — 일부 연도가 빠진 이력은 하락 구간을
 * 조용히 지운다. E2E fake 모드에서는 네트워크에 나가지 않고 던진다.
 */
export async function loadDailyCloseHistory(input: {
    symbol: string;
    source: DailyHistorySource;
    session: MarketSessionSpec;
    now: Date;
}): Promise<MarketDailyClose[]> {
    if (isE2EFakeMode())
        throw new Error('daily history is not available in E2E fake mode');
    const lastClosed = lastClosedSessionDate(input.session, input.now);
    const timeZone =
        input.session.kind === 'scheduled' ? input.session.timeZone : 'UTC';
    const rows =
        input.source === 'fmp'
            ? await loadFmpHistory(input.symbol, lastClosed)
            : await loadYahooHistory(input.symbol, timeZone);
    return rows
        .filter(row => row.date <= lastClosed)
        .toSorted((a, b) => a.date.localeCompare(b.date));
}
