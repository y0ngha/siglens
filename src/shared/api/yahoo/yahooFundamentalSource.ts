import 'server-only';
import YahooFinance from 'yahoo-finance2';
import { MS_PER_SECOND } from '@/shared/config/time';

// 설정 근거는 YahooMarketProvider / YahooOptionsAdapter 주석 참조.
const yahooFinance = new YahooFinance({
    suppressNotices: ['yahooSurvey'],
    validation: { logErrors: false },
});

/** 재무 시계열 조회 하한. 성장률은 직전 회계연도 대비이므로 3개년이면 충분하다. */
const STATEMENT_LOOKBACK_YEARS = 3;

/**
 * 같은 심볼에 대한 중복 조회를 접는 시간(ms).
 *
 * `FundamentalProvider`는 16개 메서드를 가지며 fundamental 페이지는 이들을 **병렬로**
 * 호출한다. dedup이 없으면 캐시 cold 상태에서 한 종목이 yahoo에 16번 동시 요청을 보내
 * rate limit을 부른다. 상위 `CachedFundamentalProvider`의 Redis 캐시는 warm 상태만
 * 막아 주므로, cold burst는 이 계층이 접어야 한다.
 */
const DEDUP_WINDOW_MS = 60 * MS_PER_SECOND;

export interface YahooSummary {
    price?: {
        longName?: string;
        shortName?: string;
        regularMarketPrice?: number;
        currency?: string;
    };
    assetProfile?: {
        sector?: string;
        industry?: string;
        website?: string;
        longBusinessSummary?: string;
        companyOfficers?: { name?: string; title?: string }[];
    };
    summaryDetail?: {
        marketCap?: number;
        priceToSalesTrailing12Months?: number;
    };
    defaultKeyStatistics?: {
        pegRatio?: number;
        enterpriseToEbitda?: number;
        netIncomeToCommon?: number;
        sharesOutstanding?: number;
    };
    financialData?: {
        returnOnEquity?: number;
        returnOnAssets?: number;
        operatingMargins?: number;
        profitMargins?: number;
        currentRatio?: number;
        totalDebt?: number;
        targetHighPrice?: number;
        targetLowPrice?: number;
        targetMedianPrice?: number;
        targetMeanPrice?: number;
    };
    recommendationTrend?: {
        trend?: {
            period?: string;
            strongBuy?: number;
            buy?: number;
            hold?: number;
            sell?: number;
            strongSell?: number;
        }[];
    };
    /**
     * 애널리스트 추정치. `period`는 `'0q'`(당분기) / `'+1q'` / `'0y'`(당해) / `'+1y'` 형태다.
     * FMP `analyst-estimates`의 대체 소스 — 2026-08-16 `005930.KS` 실측으로 KRX 종목에도
     * 값이 채워지는 것을 확인했다(epsAvg 14,227원 / revAvg 208.9조).
     */
    earningsTrend?: {
        trend?: {
            period?: string;
            earningsEstimate?: { avg?: number };
            revenueEstimate?: { avg?: number };
        }[];
    };
    /** 실적 발표 예정일. `isEarningsDateEstimate`가 true면 확정일이 아니라 추정일이다. */
    calendarEvents?: {
        earnings?: {
            earningsDate?: Date[];
            isEarningsDateEstimate?: boolean;
            earningsAverage?: number;
            revenueAverage?: number;
        };
    };
    /** 분기별 실적 서프라이즈 이력(실제 vs 추정). FMP `earnings`의 대체 소스. */
    earningsHistory?: {
        history?: {
            quarter?: Date;
            epsActual?: number;
            epsEstimate?: number;
            surprisePercent?: number;
        }[];
    };
}

export interface YahooStatementRow {
    date?: Date;
    totalRevenue?: number;
    netIncome?: number;
    basicEPS?: number;
    totalAssets?: number;
    stockholdersEquity?: number;
    operatingCashFlow?: number;
}

export interface YahooFundamentals {
    summary: YahooSummary | null;
    income: YahooStatementRow[];
    balance: YahooStatementRow[];
    cashFlow: YahooStatementRow[];
}

const EMPTY: YahooFundamentals = {
    summary: null,
    income: [],
    balance: [],
    cashFlow: [],
};

interface CacheEntry {
    at: number;
    value: Promise<YahooFundamentals>;
}

/**
 * 심볼별 in-flight/최근 결과 캐시.
 *
 * 항목은 만료돼도 삭제되지 않고 다음 조회에서 덮어써진다 — `cryptoAssetStore`의
 * 모듈 레벨 Map과 같은 트레이드오프다. 키 집합이 조회된 종목 수로 제한되고 프로세스가
 * 배포마다 재시작되므로 실질적인 누수는 없다.
 */
const cache = new Map<string, CacheEntry>();

/** @internal 테스트에서 케이스 간 캐시를 비운다. */
export function _resetYahooFundamentalCacheForTest(): void {
    cache.clear();
}

function lookbackStart(): string {
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - STATEMENT_LOOKBACK_YEARS);
    return d.toISOString().slice(0, 10);
}

async function fetchAll(symbol: string): Promise<YahooFundamentals> {
    const period1 = lookbackStart();
    // 네 소스는 서로 독립이라 하나가 실패해도 나머지는 살린다 — 재무 시계열이 없는
    // 종목에서도 프로필/비율은 렌더되어야 한다.
    const [summary, income, balance, cashFlow] = await Promise.all([
        yahooFinance
            .quoteSummary(symbol, {
                modules: [
                    'price',
                    'assetProfile',
                    'summaryDetail',
                    'defaultKeyStatistics',
                    'financialData',
                    'recommendationTrend',
                    'earningsTrend',
                    'calendarEvents',
                    'earningsHistory',
                ],
            })
            .catch((e: unknown) => {
                console.warn(
                    '[yahooFundamental] quoteSummary failed',
                    symbol,
                    e
                );
                return null;
            }),
        fetchStatement(symbol, 'financials', period1),
        fetchStatement(symbol, 'balance-sheet', period1),
        fetchStatement(symbol, 'cash-flow', period1),
    ]);

    return {
        summary: summary as unknown as YahooSummary | null,
        income,
        balance,
        cashFlow,
    };
}

async function fetchStatement(
    symbol: string,
    module: 'financials' | 'balance-sheet' | 'cash-flow',
    period1: string
): Promise<YahooStatementRow[]> {
    try {
        const rows = await yahooFinance.fundamentalsTimeSeries(symbol, {
            period1,
            module,
            type: 'annual',
        });
        // yahoo는 오래된 연도부터 반환한다 — 호출부가 `.at(-1)`로 최신을 집는 전제.
        return rows as unknown as YahooStatementRow[];
    } catch (e) {
        console.warn('[yahooFundamental] statement failed', symbol, module, e);
        return [];
    }
}

/**
 * 심볼의 yahoo 펀더멘털 원자료를 가져온다. `DEDUP_WINDOW_MS` 안의 중복 호출은
 * 같은 promise를 공유한다.
 *
 * 어떤 소스도 throw하지 않는다 — 전부 내부에서 흡수해 빈 값으로 degrade한다.
 * 펀더멘털은 부분 결측이 정상이므로(비상장 지표, 신규 상장 등) 호출부는 항상
 * `null` 필드를 다룰 수 있어야 한다.
 */
export function getYahooFundamentals(
    symbol: string
): Promise<YahooFundamentals> {
    const key = symbol.toUpperCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < DEDUP_WINDOW_MS) return hit.value;

    const value = fetchAll(key).catch((e: unknown) => {
        console.warn('[yahooFundamental] fetch failed', key, e);
        // 실패는 캐시에 남기지 않는다 — 다음 요청이 재시도하도록 항목을 지운다.
        cache.delete(key);
        return EMPTY;
    });
    cache.set(key, { at: Date.now(), value });
    return value;
}
