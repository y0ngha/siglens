import 'server-only';
import {
    getFmpDividendHistory,
    type FmpDividendRow,
} from '@/shared/api/fmp/dividendsClient';
import {
    getYahooDividendData,
    type YahooDividendData,
    type YahooDividendSummary,
} from '@/shared/api/yahoo/yahooDividendSource';
import { MS_PER_DAY } from '@/shared/config/time';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import { logToolDegrade } from './logToolDegrade';

/**
 * 에이전트에게 보이는 배당 요약. 이 필드명은 siglens-core 쪽 설명과의 계약이다.
 * `null` 전체는 "모름"(공급자 장애·데이터 없음), 필드가 `null`인 객체는 "그 항목만 모름"이다.
 * 확인된 무배당은 `trailing12mAmount: 0`·`trailingYieldPct: 0`·`latestExDate: null`로 낸다.
 *
 * 한계 1 — 통화: `currency`는 상장 통화(시장 descriptor)다. FMP `/dividends` 금액이 그 통화 규모인지는
 * 외국 발행사 미국 상장 ADR로 실측했다(2026-10-24: TSM 주가 418.51에 분기 배당 1.09, BABA 주가 99.64에
 * 배당 1.05 — 달러 규모). 다만 FMP가 금액 통화를 필드로 주지 않아 이 규모 추정에 기대고 있다.
 * 한계 2 — 특별·비정기 배당: FMP 행에는 정기/특별 구분이 없어(`frequency`는 신뢰하지 않는다) 특별 배당도
 * `trailing12mAmount`에 그대로 합산되고 `trailingYieldPct`를 부풀릴 수 있다. 에이전트는 이 값을
 * "최근 12개월 지급 합계"로만 말하고 "정기 배당률"로 단정하지 않는다.
 */
export interface DividendsView {
    latestExDate: string | null;
    latestAmount: number | null;
    currency: string | null;
    payDate: string | null;
    trailing12mAmount: number | null;
    trailingYieldPct: number | null;
    source: string;
}

export const FMP_DIVIDENDS_SOURCE = 'FMP dividends history';
export const YAHOO_DIVIDENDS_SOURCE = 'Yahoo Finance summaryDetail';
export const YAHOO_HISTORY_SOURCE = 'Yahoo Finance dividend history';

const TRAILING_WINDOW_DAYS = 365;
const AMOUNT_DECIMALS = 1e4;
const PCT_DECIMALS = 1e2;

function round(value: number, scale: number): number {
    return Math.round(value * scale) / scale;
}

function yieldPct(amount: number, price: number | null): number | null {
    return price === null ? null : round((amount / price) * 100, PCT_DECIMALS);
}

/**
 * 미국·ETF: 배당 이력에서 직전 배당과 트레일링 12개월을 계산한다.
 *
 * 창은 `today`(시장 현지 날짜)까지 365일이고 `today` 이후 배당락일(공시만 된 미래 배당)은
 * 직전 배당·합계에서 모두 뺀다. `price`는 `get_quote`와 같은 현재가라 장중에는 마지막 종가가
 * 아닐 수 있다. 이력이 비어 있으면 무배당으로 본다(공급자가 심볼을 알고 있고 프로필이 있는
 * 종목에서만 호출된다).
 */
export function buildFmpDividends(
    rows: readonly FmpDividendRow[],
    price: number | null,
    currency: string,
    now: Date,
    timeZone: string,
    source: string = FMP_DIVIDENDS_SOURCE
): DividendsView {
    const today = zonedDate(now, timeZone);
    const windowStart = zonedDate(
        new Date(
            Date.parse(`${today}T00:00:00Z`) - TRAILING_WINDOW_DAYS * MS_PER_DAY
        ),
        'UTC'
    );
    const past = rows
        .filter(row => row.exDate <= today)
        .sort((a, b) => b.exDate.localeCompare(a.exDate));
    const trailing = round(
        past
            .filter(row => row.exDate > windowStart)
            .reduce((sum, row) => sum + row.amount, 0),
        AMOUNT_DECIMALS
    );
    const latest = past[0];
    return {
        latestExDate: latest?.exDate ?? null,
        latestAmount: latest?.amount ?? null,
        currency,
        payDate: latest?.payDate ?? null,
        trailing12mAmount: trailing,
        trailingYieldPct: yieldPct(trailing, price),
        source,
    };
}

/**
 * 한국: 배당 **이력**(chart `events=div`)이 있으면 FMP와 같은 방식으로 트레일링 365일 합·직전 배당·
 * 수익률을 직접 계산한다(`summaryDetail`의 trailingAnnual* 필드는 KRX 종목에서 자주 비어 있어, 한 번의
 * 지급만 보고 수익률을 추정하던 오답의 원인이었다). 이력이 없거나 비어 있으면 `buildYahooSummaryDividends`로
 * 내려간다.
 */
export function buildYahooDividends(
    data: YahooDividendData,
    price: number | null,
    currency: string,
    now: Date,
    timeZone: string
): DividendsView | null {
    if (data.history !== null && data.history.length > 0)
        return buildFmpDividends(
            data.history.map(event => ({ ...event, payDate: null })),
            price,
            currency,
            now,
            timeZone,
            YAHOO_HISTORY_SOURCE
        );
    return data.summary === null
        ? null
        : buildYahooSummaryDividends(
              data.summary,
              price,
              currency,
              zonedDate(now, timeZone)
          );
}

/**
 * 이력을 못 받았을 때의 2순위: yahoo `summaryDetail`의 **트레일링** 필드로만 만든다. 전방 `dividendRate`/`dividendYield`는
 * 올해 예상치라 "최근 12개월" 필드에 섞으면 거짓이 되므로 쓰지 않는다(배당 지급 신호로만 본다).
 * 직전 1회 금액은 `lastDividendValue`가 있을 때만 채우고, 지급일은 yahoo가 주지 않아 항상 null이다.
 * `latestExDate`는 `today`(KST) 이하인 날짜만 쓴다 — 미래 배당락일은 "직전"이 아니다.
 * 모든 배당 필드가 비어 있으면 무배당과 구분할 수 없으므로 `null`(모름)이다 —
 * `trailingAnnualDividendRate`가 명시적으로 0이고 양수 배당 신호가 없을 때만 확인된 무배당이다.
 */
export function buildYahooSummaryDividends(
    summary: YahooDividendSummary,
    price: number | null,
    currency: string,
    today: string
): DividendsView | null {
    const annual = summary.trailingAnnualDividendRate;
    const yahooYield = summary.trailingAnnualDividendYield;
    const hasPositiveSignal =
        (annual ?? 0) > 0 ||
        (yahooYield ?? 0) > 0 ||
        (summary.dividendRate ?? 0) > 0 ||
        summary.exDividendDate !== null ||
        (summary.lastDividendValue ?? 0) > 0;
    if (!hasPositiveSignal) {
        return annual === 0
            ? {
                  latestExDate: null,
                  latestAmount: null,
                  currency,
                  payDate: null,
                  trailing12mAmount: 0,
                  trailingYieldPct: 0,
                  source: YAHOO_DIVIDENDS_SOURCE,
              }
            : null;
    }
    const pastOrNull = (date: string | null): string | null =>
        date !== null && date <= today ? date : null;
    const computedYield = annual === null ? null : yieldPct(annual, price);
    return {
        latestExDate:
            pastOrNull(summary.exDividendDate) ??
            pastOrNull(summary.lastDividendDate),
        latestAmount: summary.lastDividendValue,
        currency,
        payDate: null,
        trailing12mAmount:
            annual === null ? null : round(annual, AMOUNT_DECIMALS),
        trailingYieldPct:
            computedYield ??
            (yahooYield === null
                ? null
                : round(yahooYield * 100, PCT_DECIMALS)),
        source: YAHOO_DIVIDENDS_SOURCE,
    };
}

/** 공급자에서 읽은 원자료. 가격·날짜에 의존하는 계산은 `buildDividends`가 나중에 한다. */
export type DividendSource =
    | { kind: 'fmp'; rows: FmpDividendRow[] }
    | { kind: 'yahoo'; data: YahooDividendData };

/**
 * 시장에 맞는 공급자에서 원자료만 읽는다(가격이 필요 없어 도구의 병렬 fan-out에 넣을 수 있다).
 * 절대 throw하지 않고 실패(또는 yahoo 요약 없음)는 로그 후 `null`(모름)이다.
 */
export async function fetchDividendSource(
    symbol: string,
    isKr: boolean
): Promise<DividendSource | null> {
    try {
        if (isKr) {
            const data = await getYahooDividendData(symbol);
            return data === null ? null : { kind: 'yahoo', data };
        }
        return { kind: 'fmp', rows: await getFmpDividendHistory(symbol) };
    } catch (error) {
        logToolDegrade('get_fundamentals', 'dividends', error);
        return null;
    }
}

interface BuildDividendsInput {
    price: number | null;
    currency: string;
    timeZone: string;
    now?: Date;
}

/** 원자료 + 현재가로 `DividendsView`를 만든다. 원자료가 없으면 `null`(모름). */
export function buildDividends(
    source: DividendSource | null,
    { price, currency, timeZone, now = new Date() }: BuildDividendsInput
): DividendsView | null {
    if (source === null) return null;
    return source.kind === 'fmp'
        ? buildFmpDividends(source.rows, price, currency, now, timeZone)
        : buildYahooDividends(source.data, price, currency, now, timeZone);
}
