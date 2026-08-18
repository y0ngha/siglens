import 'server-only';
import { createYahooClient } from './createYahooClient';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    getYahooBalanceSheet,
    getYahooStatements,
    type YahooStatementRaw,
} from './yahooStatementsSource';

// 설정 근거는 YahooMarketProvider / YahooOptionsAdapter 주석 참조.
const yahooFinance = createYahooClient();

/**
 * 라이브러리의 응답 스키마 검증을 끈다.
 *
 * **끄지 않으면 모듈 하나의 결측이 요청 전체를 죽인다.** 실측(2026-08-17, `035420.KS`
 * NAVER): 아직 실적이 확정되지 않은 분기 하나에 `epsActual`이 없다는 이유로
 * `earningsHistory`가 `Missing required properties`로 검증 실패했고, 그 여파로
 * `quoteSummary` 응답 전체가 throw되어 프로필·밸류에이션·비율이 **통째로 null**이 됐다.
 * 나머지 8개 모듈은 정상이었는데도 함께 버려진 것이다.
 *
 * 끄는 것이 안전한 이유: `YahooSummary`가 모든 필드를 optional로 선언하고 매핑 단계가
 * 결측을 `null`로 흡수한다. 즉 우리는 라이브러리 스키마에 의존해 안전성을 얻지 않는다.
 * 반대로 yahoo는 필드를 자주 누락하므로, 라이브러리의 엄격한 스키마가 실제 응답보다
 * 좁아 정상 데이터까지 막는다.
 */
const SKIP_SCHEMA_VALIDATION = { validateResult: false } as const;

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

/**
 * 재무제표 행 타입은 `yahooStatementsSource`가 단독으로 소유한다.
 *
 * 예전에는 이 모듈이 자체 `YahooStatementRow`와 자체 fetch 로직을 들고 있었는데,
 * 두 모듈의 **정렬 규약이 서로 반대**여서(여기는 oldest-first, 저기는 newest-first)
 * 유지보수 중 성장률 부호가 뒤집힐 소지가 있었다. 게다가 같은 종목의 fundamental·
 * financials 탭을 함께 열면 캐시가 공유되지 않아 yahoo 호출이 두 배가 됐다.
 * 지금은 조회를 `getYahooStatements`에 위임해 소스·캐시·정렬 규약을 하나로 모은다.
 */
export type YahooStatementRow = YahooStatementRaw;

export interface YahooFundamentals {
    summary: YahooSummary | null;
    /** 전부 최신순(newest first) — `yahooStatementsSource`의 규약을 그대로 따른다. */
    income: YahooStatementRow[];
    balance: YahooStatementRow[];
    cashFlow: YahooStatementRow[];
    /**
     * 분기 재무상태표(최신순).
     *
     * PBR·부채비율의 분모는 **최근 보고 시점**이어야 한다. 연간 값만 쓰면 결산 이후
     * 분기가 반영되지 않아 자본이 빠르게 느는 기업에서 지표가 과대해진다.
     * 성장률 계산에는 연간(`balance`)을 그대로 쓴다 — 그쪽은 YoY 비교라 기간이 맞아야 한다.
     */
    quarterlyBalance: YahooStatementRow[];
}

const EMPTY: YahooFundamentals = {
    summary: null,
    income: [],
    balance: [],
    cashFlow: [],
    quarterlyBalance: [],
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

async function fetchAll(symbol: string): Promise<YahooFundamentals> {
    // 세 소스는 서로 독립이라 하나가 실패해도 나머지는 살린다 — 재무 시계열이 없는
    // 종목에서도 프로필/비율은 렌더되어야 한다. 재무제표는 `getYahooStatements`가
    // 자체 dedup 캐시를 들고 있어, financials 탭이 이미 조회했다면 재호출이 없다.
    //
    // 분기 재무제표를 함께 가져오는 이유: PBR·부채비율의 분모(자기자본·총자산)는
    // **가장 최근 보고 시점**을 써야 한다. 연간 값만 쓰면 결산 이후 분기 실적이
    // 반영되지 않아, 자본이 빠르게 느는 기업에서 지표가 크게 과대해진다
    // (실측: SK하이닉스 PBR 9.69 → 7.11, 36% 과대).
    const [summary, annual, quarterly] = await Promise.all([
        yahooFinance
            .quoteSummary(
                symbol,
                {
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
                },
                SKIP_SCHEMA_VALIDATION
            )
            .catch((e: unknown) => {
                console.warn(
                    '[yahooFundamental] quoteSummary failed',
                    symbol,
                    e
                );
                return null;
            }),
        getYahooStatements(symbol, 'annual'),
        // 분기는 재무상태표만 필요하다(PBR·부채비율 분모). 전체 제표를 받으면
        // 손익·현금흐름 2개 모듈이 그대로 버려져 호출이 낭비된다.
        getYahooBalanceSheet(symbol, 'quarter'),
    ]);
    const statements = { ...annual, quarterlyBalance: quarterly };

    return {
        // Safe cast: `quoteSummary`의 반환 타입은 요청한 모듈 조합에 따라 라이브러리가
        // 넓게 정의해 두어 우리가 소비하는 부분집합(`YahooSummary`)과 구조적으로
        // 대응하지 않는다. 위 `modules` 목록이 이 인터페이스의 필드와 1:1이며,
        // 모든 필드를 optional로 선언해 결측을 런타임에서 흡수한다.
        summary: summary as unknown as YahooSummary | null,
        ...statements,
    };
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
