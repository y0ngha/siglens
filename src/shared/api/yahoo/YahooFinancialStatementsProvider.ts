import 'server-only';
import type {
    BalanceSheetRow,
    CashFlowGrowthRow,
    CashFlowRow,
    FinancialGrowthRow,
    FinancialStatementsProvider,
    IncomeGrowthRow,
    IncomeStatementRow,
    StatementPeriod,
} from '@y0ngha/siglens-core';
import {
    getYahooStatements,
    type YahooStatementRaw,
} from './yahooStatementsSource';

const PERCENT = 100;

/** 분기 라벨은 3개월 단위 종료월로 판정한다(1–3월 → Q1). */
const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'] as const;
const MONTHS_PER_QUARTER = 3;

/**
 * 전년 동기와 비교하기 위해 거슬러 올라갈 행 수.
 *
 * 연간은 바로 앞 행이 전년이지만, 분기는 **4행 앞**이 전년 동기다. 인접 분기와 비교하면
 * YoY가 아니라 QoQ가 되어 계절성이 성장률로 둔갑한다(반도체처럼 분기 편차가 큰 업종에서
 * 특히 오해를 부른다). 도메인 필드명이 전부 `YoY growth`로 정의되어 있으므로 여기서
 * 주기별 오프셋을 맞춘다.
 */
function yoyOffset(period: StatementPeriod): number {
    return period === 'annual' ? 1 : 4;
}

function toNullable(v: number | undefined): number | null {
    return v ?? null;
}

function isoDate(d: Date | undefined): string {
    return d instanceof Date ? d.toISOString().slice(0, 10) : '';
}

function fiscalYearOf(row: YahooStatementRaw): string {
    return row.date instanceof Date ? String(row.date.getUTCFullYear()) : '';
}

function periodLabelOf(
    row: YahooStatementRaw,
    period: StatementPeriod
): string {
    if (period === 'annual') return 'FY';
    if (!(row.date instanceof Date)) return '';
    // getUTCMonth()는 0-indexed — 결산월(3월 = index 2)을 3개월로 나눠 분기 인덱스를 얻는다.
    return (
        QUARTER_LABELS[
            Math.floor(row.date.getUTCMonth() / MONTHS_PER_QUARTER)
        ] ?? ''
    );
}

/** 마진(%) — 매출이 0이거나 없으면 null. 음수 매출은 존재하지 않으므로 <= 0으로 막는다. */
function marginPercent(
    part: number | undefined,
    revenue: number | undefined
): number | null {
    if (part === undefined || revenue === undefined || revenue <= 0)
        return null;
    return (part / revenue) * PERCENT;
}

/**
 * (현재 − 전년) / |전년|. 절댓값으로 나눠 적자→흑자 전환에서 부호가 뒤집히지 않게 한다
 * (`yahooFundamentalMap.growthRate`와 같은 규약).
 */
function growth(
    current: number | undefined,
    prior: number | undefined
): number | null {
    if (current === undefined || prior === undefined || prior === 0)
        return null;
    return (current - prior) / Math.abs(prior);
}

function mapIncome(
    rows: YahooStatementRaw[],
    period: StatementPeriod,
    limit: number
): IncomeStatementRow[] {
    return rows.slice(0, limit).map(r => ({
        fiscalYear: fiscalYearOf(r),
        period: periodLabelOf(r, period),
        date: isoDate(r.date),
        revenue: toNullable(r.totalRevenue),
        grossProfit: toNullable(r.grossProfit),
        operatingIncome: toNullable(r.operatingIncome),
        netIncome: toNullable(r.netIncome),
        ebitda: toNullable(r.EBITDA),
        eps: toNullable(r.basicEPS),
        epsDiluted: toNullable(r.dilutedEPS),
        // yahoo는 마진을 주지 않는다 — 같은 행의 매출로 계산한다.
        grossMargin: marginPercent(r.grossProfit, r.totalRevenue),
        operatingMargin: marginPercent(r.operatingIncome, r.totalRevenue),
        netMargin: marginPercent(r.netIncome, r.totalRevenue),
    }));
}

function mapBalance(
    rows: YahooStatementRaw[],
    period: StatementPeriod,
    limit: number
): BalanceSheetRow[] {
    return rows.slice(0, limit).map(r => {
        const cash = r.cashCashEquivalentsAndShortTermInvestments;
        return {
            fiscalYear: fiscalYearOf(r),
            period: periodLabelOf(r, period),
            date: isoDate(r.date),
            totalAssets: toNullable(r.totalAssets),
            totalCurrentAssets: toNullable(r.currentAssets),
            totalLiabilities: toNullable(r.totalLiabilitiesNetMinorityInterest),
            totalCurrentLiabilities: toNullable(r.currentLiabilities),
            cashAndShortTermInvestments: toNullable(cash),
            totalDebt: toNullable(r.totalDebt),
            // yahoo는 netDebt를 비워 보낸다(실측: 항상 null) — 정의대로 직접 계산한다.
            // 음수면 순현금 상태를 뜻하며 도메인이 그대로 해석한다.
            netDebt:
                r.totalDebt !== undefined && cash !== undefined
                    ? r.totalDebt - cash
                    : null,
            totalStockholdersEquity: toNullable(r.stockholdersEquity),
            currentRatio:
                r.currentAssets !== undefined &&
                r.currentLiabilities !== undefined &&
                r.currentLiabilities > 0
                    ? r.currentAssets / r.currentLiabilities
                    : null,
        };
    });
}

function mapCashFlow(
    rows: YahooStatementRaw[],
    period: StatementPeriod,
    limit: number
): CashFlowRow[] {
    return rows.slice(0, limit).map(r => ({
        fiscalYear: fiscalYearOf(r),
        period: periodLabelOf(r, period),
        date: isoDate(r.date),
        operatingCashFlow: toNullable(r.operatingCashFlow),
        capitalExpenditure: toNullable(r.capitalExpenditure),
        freeCashFlow: toNullable(r.freeCashFlow),
        dividendsPaid: toNullable(r.cashDividendsPaid),
        // fcfMargin은 매출이 필요해 스냅샷 정규화 단계에서 채워진다(도메인 주석 참조).
        fcfMargin: null,
    }));
}

/**
 * 성장률 행을 만든다. `rows[i]`와 `rows[i + offset]`(더 과거)을 비교하며, 전년 동기가
 * 없는 가장 오래된 구간은 결과에서 빠진다 — null로 채운 행을 내보내면 화면에
 * "성장률 0%"처럼 보이는 빈 막대가 생긴다.
 */
function growthRows<T>(
    rows: YahooStatementRaw[],
    period: StatementPeriod,
    limit: number,
    build: (curr: YahooStatementRaw, prior: YahooStatementRaw) => T
): T[] {
    const offset = yoyOffset(period);
    const result: T[] = [];
    for (let i = 0; i + offset < rows.length && result.length < limit; i++) {
        result.push(build(rows[i]!, rows[i + offset]!));
    }
    return result;
}

function labels(
    row: YahooStatementRaw,
    period: StatementPeriod
): { fiscalYear: string; period: string } {
    return {
        fiscalYear: fiscalYearOf(row),
        period: periodLabelOf(row, period),
    };
}

/**
 * KRX 종목용 `FinancialStatementsProvider` — yahoo-finance2 백엔드.
 *
 * FMP는 성장률을 전용 엔드포인트(`/income-statement-growth` 등)로 제공하지만 yahoo에는
 * 대응이 없다. 세 성장률 표는 이미 가져온 재무제표 행끼리 비교해 파생한다 — 단순
 * 산술이며 지표 계산식이 아니므로 어댑터 책임이다(`SCOPE.md`).
 *
 * 다년 성장률(3/5/10년 주당매출)은 제공하지 않는다. 주당 값이라 각 연도의 주식수가
 * 필요한데 yahoo 재무 시계열이 과거 주식수를 일관되게 채워 주지 않아, 계산하면 자사주
 * 매입·분할이 성장률로 잘못 반영된다.
 */
export class YahooFinancialStatementsProvider implements FinancialStatementsProvider {
    async getIncomeStatements(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<IncomeStatementRow[]> {
        const { income } = await getYahooStatements(symbol, period);
        return mapIncome(income, period, limit);
    }

    async getBalanceSheets(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<BalanceSheetRow[]> {
        const { balance } = await getYahooStatements(symbol, period);
        return mapBalance(balance, period, limit);
    }

    async getCashFlowStatements(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<CashFlowRow[]> {
        const { cashFlow } = await getYahooStatements(symbol, period);
        return mapCashFlow(cashFlow, period, limit);
    }

    async getIncomeStatementGrowths(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<IncomeGrowthRow[]> {
        const { income } = await getYahooStatements(symbol, period);
        return growthRows(income, period, limit, (curr, prior) => ({
            ...labels(curr, period),
            growthRevenue: growth(curr.totalRevenue, prior.totalRevenue),
            growthNetIncome: growth(curr.netIncome, prior.netIncome),
            growthEPS: growth(curr.basicEPS, prior.basicEPS),
            growthOperatingIncome: growth(
                curr.operatingIncome,
                prior.operatingIncome
            ),
        }));
    }

    async getFinancialGrowths(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<FinancialGrowthRow[]> {
        const { income, balance, cashFlow } = await getYahooStatements(
            symbol,
            period
        );

        return growthRows(income, period, limit, (curr, prior) => {
            // 세 제표는 같은 기간을 담지만 행 수가 다를 수 있다(제표별 결측). 인덱스를
            // 공유하면 서로 다른 기간을 비교하게 되므로 결산일로 맞춘다.
            const bCurr = rowAt(balance, curr);
            const bPrior = rowAt(balance, prior);
            const cCurr = rowAt(cashFlow, curr);
            const cPrior = rowAt(cashFlow, prior);

            return {
                ...labels(curr, period),
                revenueGrowth: growth(curr.totalRevenue, prior.totalRevenue),
                netIncomeGrowth: growth(curr.netIncome, prior.netIncome),
                epsGrowth: growth(curr.basicEPS, prior.basicEPS),
                freeCashFlowGrowth: growth(
                    cCurr?.freeCashFlow,
                    cPrior?.freeCashFlow
                ),
                operatingCashFlowGrowth: growth(
                    cCurr?.operatingCashFlow,
                    cPrior?.operatingCashFlow
                ),
                assetGrowth: growth(bCurr?.totalAssets, bPrior?.totalAssets),
                debtGrowth: growth(bCurr?.totalDebt, bPrior?.totalDebt),
                // 주당 다년 성장률은 과거 주식수가 필요해 제공하지 않는다(클래스 주석 참조).
                threeYRevenueGrowthPerShare: null,
                fiveYRevenueGrowthPerShare: null,
                tenYRevenueGrowthPerShare: null,
            };
        });
    }

    async getCashFlowGrowths(
        symbol: string,
        period: StatementPeriod,
        limit: number
    ): Promise<CashFlowGrowthRow[]> {
        const { cashFlow } = await getYahooStatements(symbol, period);
        return growthRows(cashFlow, period, limit, (curr, prior) => ({
            ...labels(curr, period),
            growthOperatingCashFlow: growth(
                curr.operatingCashFlow,
                prior.operatingCashFlow
            ),
            growthFreeCashFlow: growth(curr.freeCashFlow, prior.freeCashFlow),
            growthCapitalExpenditure: growth(
                curr.capitalExpenditure,
                prior.capitalExpenditure
            ),
        }));
    }
}

/** 같은 결산일의 행을 찾는다 — 제표별로 행 수가 달라 인덱스를 그대로 쓸 수 없다. */
function rowAt(
    rows: YahooStatementRaw[],
    reference: YahooStatementRaw
): YahooStatementRaw | undefined {
    const target = isoDate(reference.date);
    return rows.find(r => isoDate(r.date) === target);
}
