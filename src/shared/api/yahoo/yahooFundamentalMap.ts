import type {
    FundamentalAnalystEstimateInput,
    FundamentalCashFlowInput,
    FundamentalGradesConsensusInput,
    FundamentalGrowthInput,
    FundamentalPriceTargetConsensusInput,
    FundamentalProfile,
    FundamentalRatiosInput,
    FundamentalValuationMetrics,
} from '@y0ngha/siglens-core';
import type {
    YahooFundamentals,
    YahooStatementRow,
    YahooSummary,
} from './yahooFundamentalSource';

/**
 * 0이나 음수 분모로 나눗셈을 막는다.
 *
 * 분모가 음수인 경우(자본잠식 기업의 `stockholdersEquity` 등)까지 `null`로 처리하는 것은
 * 의도적이다 — 음수 PBR/PER은 수학적으로는 계산되지만 밸류에이션 지표로서 의미가 없고,
 * 화면에서는 "저평가"로 오독된다. FMP도 이런 경우 필드를 비워 보낸다.
 */
function safeRatio(
    numerator: number | undefined,
    denominator: number | undefined
): number | null {
    if (
        numerator === undefined ||
        denominator === undefined ||
        denominator <= 0
    ) {
        return null;
    }
    return numerator / denominator;
}

function toNullable(v: number | undefined): number | null {
    return v ?? null;
}

/**
 * 최신 회계연도 행.
 *
 * `yahooStatementsSource`가 이미 최신순으로 뒤집어 넘기므로 **맨 앞이 최신**이다.
 * (예전에는 이 모듈만 oldest-first를 가정해 `.at(-1)`을 썼고, 같은 데이터를 다루는
 * 두 모듈의 규약이 반대라 성장률 부호가 뒤집힐 소지가 있었다.)
 */
function latest(rows: YahooStatementRow[]): YahooStatementRow | undefined {
    return rows[0];
}

/** 직전 회계연도 행 — 성장률 계산의 기준. */
function previous(rows: YahooStatementRow[]): YahooStatementRow | undefined {
    return rows[1];
}

const CEO_TITLE_RE = /\bCEO\b|Chief Executive/i;

/** 임원 목록에서 CEO를 고른다. yahoo는 직함 문자열만 주므로 패턴 매칭이 유일한 방법. */
function findCeo(
    officers: { name?: string; title?: string }[] | undefined
): string | null {
    const ceo = officers?.find(o => o.title && CEO_TITLE_RE.test(o.title));
    return ceo?.name?.trim() || null;
}

export function mapProfile(
    symbol: string,
    data: YahooFundamentals
): FundamentalProfile | null {
    const { summary } = data;
    if (!summary) return null;

    const companyName =
        summary.price?.longName || summary.price?.shortName || symbol;

    return {
        symbol,
        companyName,
        sector: summary.assetProfile?.sector ?? '',
        industry: summary.assetProfile?.industry ?? '',
        marketCap: summary.summaryDetail?.marketCap ?? 0,
        ceo: findCeo(summary.assetProfile?.companyOfficers),
        website: summary.assetProfile?.website ?? null,
        description: summary.assetProfile?.longBusinessSummary ?? null,
    };
}

/**
 * 밸류에이션 지표. yahoo는 KRX 종목에 `trailingPE`/`priceToBook`/`trailingEps`/`bookValue`를
 * 하나도 주지 않으므로(2026-08-17 실측, 5종목 전부 `n/a`) 확보한 값들로 파생 계산한다.
 *
 *   PER = marketCap / netIncomeToCommon(TTM 지배주주 순이익)
 *   PBR = marketCap / stockholdersEquity(**최신 분기** 자기자본)
 *   EPS = netIncomeToCommon / 내재주식수(marketCap / price)
 *
 * **주식수를 시가총액에서 역산하는 이유**: yahoo가 주는 `sharesOutstanding`은 KRX
 * 종목에서 시가총액의 산출 기준과 어긋난다. 삼성전자 실측 —
 * `sharesOutstanding` 5.764B인데 `marketCap / price`로 역산하면 6.567B다(우선주
 * 005935 등의 처리 차이). 전자로 EPS를 내면 보고된 분기 EPS 합(22,683원) 대비
 * **14.5% 과대**(25,977원)해진다. 내재주식수를 쓰면 22,802원으로 오차가 0.53%로 줄고,
 * SK하이닉스도 0.35% 이내였다.
 *
 * 부수 효과로 `price / epsTTM === peRatioTTM`이 항등식으로 성립한다 — 두 지표가 같은
 * 분모를 공유하므로 화면에서 서로 어긋나지 않는다.
 *
 * **PBR 분모가 분기인 이유**: 연간(결산) 자본을 쓰면 결산 이후 분기 이익이 반영되지
 * 않는다. 실측에서 SK하이닉스가 9.69 vs 7.11로 **36% 과대**했다. PER이 TTM 기준이므로
 * PBR도 최신 시점으로 맞춰야 두 지표의 기준이 일관된다.
 */
export function mapKeyMetrics(
    data: YahooFundamentals
): FundamentalValuationMetrics | null {
    const { summary } = data;
    if (!summary) return null;

    const marketCap = summary.summaryDetail?.marketCap;
    const netIncome = summary.defaultKeyStatistics?.netIncomeToCommon;
    // 분기 자본이 없는 종목(신규 상장 등)은 연간으로 폴백한다 — 없는 것보다 낫다.
    const equity =
        latest(data.quarterlyBalance)?.stockholdersEquity ??
        latest(data.balance)?.stockholdersEquity;

    return {
        peRatioTTM: safeRatio(marketCap, netIncome),
        priceToSalesRatioTTM: toNullable(
            summary.summaryDetail?.priceToSalesTrailing12Months
        ),
        pbRatioTTM: safeRatio(marketCap, equity),
        pegRatioTTM: toNullable(summary.defaultKeyStatistics?.pegRatio),
        enterpriseValueOverEBITDATTM: toNullable(
            summary.defaultKeyStatistics?.enterpriseToEbitda
        ),
        epsTTM: safeRatio(netIncome, impliedShareCount(summary)),
    };
}

/**
 * 시가총액 ÷ 현재가 = 시총 산출에 실제로 쓰인 주식수.
 *
 * yahoo가 별도로 주는 `sharesOutstanding`을 신뢰하지 않는 이유는 `mapKeyMetrics`
 * 주석 참조. 둘 중 하나라도 없거나 0이면 `undefined`를 돌려 `safeRatio`가 `null`로
 * 처리하게 한다.
 */
function impliedShareCount(summary: YahooSummary): number | undefined {
    const marketCap = summary.summaryDetail?.marketCap;
    const price = summary.price?.regularMarketPrice;
    if (!marketCap || !price || price <= 0) return undefined;
    return marketCap / price;
}

export function mapRatios(
    data: YahooFundamentals
): FundamentalRatiosInput | null {
    const fd = data.summary?.financialData;
    if (!fd) return null;

    return {
        returnOnEquityTTM: toNullable(fd.returnOnEquity),
        returnOnAssetsTTM: toNullable(fd.returnOnAssets),
        operatingProfitMarginTTM: toNullable(fd.operatingMargins),
        netProfitMarginTTM: toNullable(fd.profitMargins),
        // yahoo는 부채비율을 자기자본 대비(`debtToEquity`, 백분율)로만 준다.
        // 도메인이 기대하는 debtRatio는 총자산 대비이므로 재무제표에서 직접 계산한다.
        // 분자 `totalDebt`가 TTM 시점 값이므로 분모도 최신 분기 총자산을 쓴다 —
        // 연간과 섞으면 PBR에서 드러난 것과 같은 기준 불일치가 생긴다.
        debtRatioTTM: safeRatio(
            fd.totalDebt,
            latest(data.quarterlyBalance)?.totalAssets ??
                latest(data.balance)?.totalAssets
        ),
        currentRatioTTM: toNullable(fd.currentRatio),
    };
}

export function mapCashFlow(
    data: YahooFundamentals
): FundamentalCashFlowInput | null {
    const row = latest(data.cashFlow);
    if (!row) return null;
    return { operatingCashFlow: toNullable(row.operatingCashFlow) };
}

/**
 * 전년 대비 성장률. yahoo `financialData.revenueGrowth`/`earningsGrowth`는 분기
 * 기준이라 FMP의 연간 `growthRevenue`/`growthEPS`와 의미가 다르다 — 같은 화면에
 * 섞이면 비교가 깨지므로 연간 재무제표에서 직접 계산한다.
 */
export function mapIncomeGrowth(
    data: YahooFundamentals
): FundamentalGrowthInput | null {
    const curr = latest(data.income);
    const prev = previous(data.income);
    if (!curr || !prev) return null;

    return {
        growthRevenue: growthRate(curr.totalRevenue, prev.totalRevenue),
        growthEPS: growthRate(curr.basicEPS, prev.basicEPS),
    };
}

/**
 * (현재 − 직전) / |직전|. 직전 값이 음수여도 부호가 뒤집히지 않도록 절댓값으로 나눈다
 * (적자에서 흑자 전환한 해의 EPS 성장률이 음수로 표시되는 오류를 막는다).
 */
function growthRate(
    current: number | undefined,
    prior: number | undefined
): number | null {
    if (current === undefined || prior === undefined || prior === 0)
        return null;
    return (current - prior) / Math.abs(prior);
}

export function mapPriceTargetConsensus(
    data: YahooFundamentals
): FundamentalPriceTargetConsensusInput | null {
    const fd = data.summary?.financialData;
    if (!fd) return null;
    const consensus = {
        targetHigh: toNullable(fd.targetHighPrice),
        targetLow: toNullable(fd.targetLowPrice),
        targetMedian: toNullable(fd.targetMedianPrice),
        targetConsensus: toNullable(fd.targetMeanPrice),
    };
    // 애널리스트 커버리지가 없는 종목은 네 값이 모두 비어 온다 — 빈 카드를 렌더하느니
    // null로 통일해 상위의 "데이터 없음" 분기를 타게 한다.
    return Object.values(consensus).every(v => v === null) ? null : consensus;
}

/**
 * 애널리스트 추정치 — 당분기(`'0q'`) 기준.
 *
 * FMP `analyst-estimates`는 다음 회계연도 평균을 주지만, yahoo `earningsTrend`는 기간별
 * 배열이라 어느 기간을 쓸지 골라야 한다. **당분기(`0q`)** 를 택한 이유: 도메인이 이 값을
 * "다음 실적 발표에 대한 시장 기대치"로 쓰고, 연간(`0y`)은 이미 지나간 분기가 섞여 있어
 * 발표 임박 시점의 기대치를 반영하지 못한다.
 */
export function mapAnalystEstimate(
    data: YahooFundamentals
): FundamentalAnalystEstimateInput | null {
    const trend = data.summary?.earningsTrend?.trend;
    const current = trend?.find(t => t.period === '0q') ?? trend?.[0];
    if (!current) return null;

    const estimatedEpsAvg = toNullable(current.earningsEstimate?.avg);
    const estimatedRevenueAvg = toNullable(current.revenueEstimate?.avg);
    // 둘 다 비면 커버리지가 없는 종목이다 — 빈 카드 대신 null로 상위 "데이터 없음" 분기를 탄다.
    return estimatedEpsAvg === null && estimatedRevenueAvg === null
        ? null
        : { estimatedEpsAvg, estimatedRevenueAvg };
}

/**
 * 실적 발표 예정일 + 과거 서프라이즈 이력.
 *
 * yahoo는 FMP `earnings`처럼 한 배열로 주지 않고 두 모듈로 나눠 준다:
 * - `calendarEvents.earnings` → **미래** 1건(예정일 + 컨센서스)
 * - `earningsHistory.history` → **과거** 분기별 실제/추정/서프라이즈
 *
 * 뉴스 탭의 실적 비교가 둘 다 필요하므로 최신순으로 합쳐서 돌려준다.
 * `isEarningsDateEstimate: true`인 예정일은 확정 공시가 아니라 yahoo 추정이다 —
 * `rawPayload.isEstimate`로 표시해 상위가 "예정(추정)"으로 렌더할 수 있게 남긴다.
 */
export function mapEarningsReports(
    symbol: string,
    data: YahooFundamentals,
    limit: number
): YahooEarningsItem[] {
    const items: YahooEarningsItem[] = [];

    const upcoming = data.summary?.calendarEvents?.earnings;
    const upcomingDate = upcoming?.earningsDate?.[0];
    if (upcomingDate instanceof Date) {
        items.push({
            symbol,
            earningsDate: isoDate(upcomingDate),
            epsActual: null,
            epsEstimated: toNullable(upcoming?.earningsAverage),
            revenueActual: null,
            revenueEstimated: toNullable(upcoming?.revenueAverage),
            lastUpdated: null,
            isEstimatedDate: upcoming?.isEarningsDateEstimate === true,
        });
    }

    for (const h of data.summary?.earningsHistory?.history ?? []) {
        if (!(h.quarter instanceof Date)) continue;
        items.push({
            symbol,
            earningsDate: isoDate(h.quarter),
            epsActual: toNullable(h.epsActual),
            epsEstimated: toNullable(h.epsEstimate),
            // yahoo `earningsHistory`는 매출을 주지 않는다(EPS만).
            revenueActual: null,
            revenueEstimated: null,
            lastUpdated: null,
            isEstimatedDate: false,
        });
    }

    return items
        .toSorted((a, b) => b.earningsDate.localeCompare(a.earningsDate))
        .slice(0, limit);
}

/** ISO `YYYY-MM-DD`. */
function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** yahoo 실적 항목 — `FmpEarningsReportItem`에서 FMP 전용 `rawPayload`를 뺀 형태. */
export interface YahooEarningsItem {
    symbol: string;
    earningsDate: string;
    epsActual: number | null;
    epsEstimated: number | null;
    revenueActual: number | null;
    revenueEstimated: number | null;
    lastUpdated: string | null;
    /** yahoo가 추정한 예정일(확정 공시 아님). */
    isEstimatedDate: boolean;
}

/** yahoo `recommendationTrend.trend`의 첫 항목(`period: '0m'`)이 현재 컨센서스다. */
export function mapGradesConsensus(
    data: YahooFundamentals
): FundamentalGradesConsensusInput | null {
    const current = data.summary?.recommendationTrend?.trend?.[0];
    if (!current) return null;
    return {
        strongBuy: current.strongBuy ?? 0,
        buy: current.buy ?? 0,
        hold: current.hold ?? 0,
        sell: current.sell ?? 0,
        strongSell: current.strongSell ?? 0,
    };
}
