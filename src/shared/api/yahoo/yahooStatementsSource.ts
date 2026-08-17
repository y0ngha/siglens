import 'server-only';
import YahooFinance from 'yahoo-finance2';
import type { StatementPeriod } from '@y0ngha/siglens-core';
import { MS_PER_SECOND } from '@/shared/config/time';

// 설정 근거는 YahooMarketProvider / YahooOptionsAdapter 주석 참조.
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
    validation: { logErrors: false },
});

/**
 * 조회 하한. 연간은 재무제표 탭이 보여 주는 최대 연수를 덮고, 분기는 전년 동기 대비
 * 성장률을 내려면 최소 5개 분기가 필요하므로 넉넉히 3년을 잡는다.
 */
const ANNUAL_LOOKBACK_YEARS = 10;
const QUARTERLY_LOOKBACK_YEARS = 3;

/** `yahooFundamentalSource`와 같은 이유의 dedup 창 — 세 재무제표를 병렬로 요구받는다. */
const DEDUP_WINDOW_MS = 60 * MS_PER_SECOND;

export interface YahooStatementRaw {
    date?: Date;
    periodType?: string;
    // income
    totalRevenue?: number;
    grossProfit?: number;
    operatingIncome?: number;
    netIncome?: number;
    EBITDA?: number;
    basicEPS?: number;
    dilutedEPS?: number;
    // balance sheet
    totalAssets?: number;
    currentAssets?: number;
    totalLiabilitiesNetMinorityInterest?: number;
    currentLiabilities?: number;
    cashCashEquivalentsAndShortTermInvestments?: number;
    totalDebt?: number;
    netDebt?: number;
    stockholdersEquity?: number;
    // cash flow
    operatingCashFlow?: number;
    capitalExpenditure?: number;
    freeCashFlow?: number;
    cashDividendsPaid?: number;
}

export interface YahooStatements {
    /** 모두 최신순(newest first)으로 정렬되어 있다 — 도메인 행 계약과 동일. */
    income: YahooStatementRaw[];
    balance: YahooStatementRaw[];
    cashFlow: YahooStatementRaw[];
}

const EMPTY: YahooStatements = { income: [], balance: [], cashFlow: [] };

const cache = new Map<
    string,
    { at: number; value: Promise<YahooStatements> }
>();

/** @internal 테스트에서 케이스 간 캐시를 비운다. */
export function _resetYahooStatementsCacheForTest(): void {
    cache.clear();
}

function lookbackStart(period: StatementPeriod): string {
    const years =
        period === 'annual' ? ANNUAL_LOOKBACK_YEARS : QUARTERLY_LOOKBACK_YEARS;
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - years);
    return d.toISOString().slice(0, 10);
}

async function fetchModule(
    symbol: string,
    module: 'financials' | 'balance-sheet' | 'cash-flow',
    period: StatementPeriod
): Promise<YahooStatementRaw[]> {
    try {
        const rows = await yahooFinance.fundamentalsTimeSeries(
            symbol,
            {
                period1: lookbackStart(period),
                module,
                // 도메인의 `'quarter'`와 yahoo의 `'quarterly'`는 표기가 다르다.
                type: period === 'annual' ? 'annual' : 'quarterly',
            },
            // 스키마 검증을 끄는 근거는 `yahooFundamentalSource`의
            // `SKIP_SCHEMA_VALIDATION` 주석 참조 — 필드 하나의 결측이 제표 전체를
            // 버리게 두지 않는다.
            { validateResult: false }
        );
        // yahoo는 오래된 기간부터 반환한다. 도메인 계약(newest first)에 맞춰 뒤집는다 —
        // 이 순서를 어기면 성장률이 부호까지 반대로 계산된다.
        //
        // Safe cast: `fundamentalsTimeSeries`의 반환 타입은 module 인자에 따라 필드가
        // 완전히 달라지는 넓은 형태라 세 제표의 합집합인 우리 타입과 구조적으로
        // 대응하지 않는다. `YahooStatementRaw`는 모든 필드를 optional로 선언하고
        // 매핑 단계가 결측을 `null`로 흡수하므로 형상이 어긋나도 런타임에서 안전하다.
        return (rows as unknown as YahooStatementRaw[]).toReversed();
    } catch (e) {
        console.warn('[yahooStatements] fetch failed', symbol, module, e);
        return [];
    }
}

async function fetchAll(
    symbol: string,
    period: StatementPeriod
): Promise<YahooStatements> {
    const [income, balance, cashFlow] = await Promise.all([
        fetchModule(symbol, 'financials', period),
        fetchModule(symbol, 'balance-sheet', period),
        fetchModule(symbol, 'cash-flow', period),
    ]);
    return { income, balance, cashFlow };
}

/**
 * 심볼×주기 단위로 세 재무제표를 한 번에 가져온다. `DEDUP_WINDOW_MS` 안의 중복 호출은
 * 같은 promise를 공유한다 — 재무제표 탭은 6개 메서드를 병렬로 부르므로 dedup이 없으면
 * 한 종목이 yahoo에 18번 동시 요청을 보낸다.
 *
 * throw하지 않는다. 모듈 단위로 실패를 흡수해 빈 배열로 degrade하므로, 일부 제표가
 * 없는 종목(신규 상장 등)도 나머지는 정상 렌더된다.
 */
export function getYahooStatements(
    symbol: string,
    period: StatementPeriod
): Promise<YahooStatements> {
    const key = `${symbol.toUpperCase()}:${period}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < DEDUP_WINDOW_MS) return hit.value;

    const value = fetchAll(symbol.toUpperCase(), period).catch((e: unknown) => {
        console.warn('[yahooStatements] fetch failed', key, e);
        cache.delete(key);
        return EMPTY;
    });
    cache.set(key, { at: Date.now(), value });
    return value;
}
