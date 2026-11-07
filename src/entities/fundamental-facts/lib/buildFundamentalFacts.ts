import {
    FUNDAMENTAL_FACT_THRESHOLDS as T,
    FUNDAMENTAL_INDEX_MIN_FACTS,
    type FundamentalFact,
    type FundamentalFactsEarningsRow,
    type FundamentalFactsInput,
} from '../model';

const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` 두 날짜 사이의 일수(b − a). 형식이 틀리면 `null`. */
function daysBetween(a: string, b: string): number | null {
    const ta = Date.parse(`${a.slice(0, 10)}T00:00:00Z`);
    const tb = Date.parse(`${b.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
    return Math.round((tb - ta) / MS_PER_DAY);
}

function cashRunway(input: FundamentalFactsInput): FundamentalFact | null {
    const annual = input.annual;
    if (annual === null) return null;
    const { cashAndShortTermInvestments: cash, operatingCashFlow: ocf } =
        annual;
    if (cash === null || ocf === null || ocf >= 0 || cash <= 0) return null;
    if (annual.netIncome === null || annual.netIncome >= 0) return null;
    const annualBurn = -ocf;
    return {
        kind: 'cashRunway',
        cash,
        annualBurn,
        years: cash / annualBurn,
        reportedCurrency: annual.reportedCurrency,
        asOf: annual.date,
    };
}

function dilutionFilings(input: FundamentalFactsInput): FundamentalFact | null {
    const dilution = input.scorecard?.dilution;
    const metrics = dilution?.metrics;
    if (!metrics || metrics.filingsInWindow < 1) return null;
    return {
        kind: 'dilutionFilings',
        filings: metrics.filingsInWindow,
        atmFilings: metrics.atmFilings,
        shelfFilings: metrics.shelfFilings,
        windowDays: input.scorecard?.freshness.dilutionWindow.days ?? 0,
        latestFilingDate: metrics.latestFilingDate,
    };
}

function insider(input: FundamentalFactsInput): FundamentalFact | null {
    const axis = input.scorecard?.insider;
    if (!axis) return null;
    const kr = axis.krMetrics;
    if (kr) {
        if (kr.reports < 1) return null;
        return {
            kind: 'insiderReportsKr',
            reports: kr.reports,
            reporters: kr.reporters,
            netSharesChange: kr.netSharesChange,
            latestReceiptDate: kr.latestReceiptDate,
        };
    }
    const m = axis.metrics;
    if (!m || m.buyCount + m.sellCount < 1) return null;
    return {
        kind: 'insiderTrades',
        buyCount: m.buyCount,
        sellCount: m.sellCount,
        buyValueUsd: m.buyValueUsd,
        sellValueUsd: m.sellValueUsd,
        windowDays: input.scorecard?.freshness.insiderWindow.days ?? 0,
    };
}

function shortInterest(input: FundamentalFactsInput): FundamentalFact | null {
    const scorecard = input.scorecard;
    const m = scorecard?.short.metrics;
    if (!scorecard || !m) return null;
    const pctHit =
        m.shortInterestPctFloat !== null &&
        m.shortInterestPctFloat >= T.shortPctFloatMin;
    const dtcHit = m.daysToCover !== null && m.daysToCover >= T.daysToCoverMin;
    if (!pctHit && !dtcHit) return null;
    return {
        kind: 'shortInterest',
        pctFloat: m.shortInterestPctFloat,
        daysToCover: m.daysToCover,
        settlementDate: scorecard.freshness.shortInterestSettlementDate,
    };
}

function priceTarget(input: FundamentalFactsInput): FundamentalFact | null {
    const consensus = input.priceTargetConsensus?.targetConsensus ?? null;
    if (consensus === null || consensus <= 0) return null;
    const g = input.grades;
    const summary = input.priceTargetSummary;
    const stale =
        summary !== null &&
        summary.lastQuarter.avgPriceTarget === null &&
        summary.lastYear.avgPriceTarget !== null;
    return {
        kind: 'priceTarget',
        consensus,
        low: input.priceTargetConsensus?.targetLow ?? null,
        high: input.priceTargetConsensus?.targetHigh ?? null,
        buy: g ? g.strongBuy + g.buy : 0,
        hold: g ? g.hold : 0,
        sell: g ? g.sell + g.strongSell : 0,
        stale,
    };
}

function completedDesc(
    rows: readonly FundamentalFactsEarningsRow[],
    today: string
): FundamentalFactsEarningsRow[] {
    return (
        rows
            // 예상치가 없는 발표도 남긴다 — 빼면 그 분기를 건너뛰어 "연속"이 끊긴 분기를 넘어 이어진다.
            // 예상치가 없으면 방향을 정할 수 없으므로 연속은 거기서 멈춘다(`surpriseDirection` → null).
            .filter(r => r.earningsDate <= today && r.epsActual !== null)
            .toSorted((a, b) => b.earningsDate.localeCompare(a.earningsDate))
    );
}

function surpriseDirection(
    row: FundamentalFactsEarningsRow
): 'beat' | 'miss' | null {
    if (row.epsActual === null || row.epsEstimated === null) return null;
    if (row.epsActual > row.epsEstimated) return 'beat';
    if (row.epsActual < row.epsEstimated) return 'miss';
    return null;
}

function epsStreak(input: FundamentalFactsInput): FundamentalFact | null {
    if (!input.earnings) return null;
    const done = completedDesc(input.earnings, input.today);
    const first = done[0];
    const direction = first ? surpriseDirection(first) : null;
    if (!first || direction === null) return null;
    const firstMismatch = done.findIndex(
        r => surpriseDirection(r) !== direction
    );
    const count = firstMismatch === -1 ? done.length : firstMismatch;
    if (count < T.epsStreakMin) return null;
    return {
        kind: 'epsStreak',
        direction,
        count,
        latestDate: first.earningsDate,
    };
}

function surprisePct(row: FundamentalFactsEarningsRow): number | null {
    if (row.epsActual === null || row.epsEstimated === null) return null;
    if (row.epsEstimated === 0) return null;
    return (
        ((row.epsActual - row.epsEstimated) / Math.abs(row.epsEstimated)) * 100
    );
}

function nextEarnings(input: FundamentalFactsInput): FundamentalFact | null {
    const date = input.nextEarningsDate?.slice(0, 10) ?? null;
    if (date === null || date <= input.today) return null;
    const daysUntil = daysBetween(input.today, date);
    if (daysUntil === null || daysUntil > T.nextEarningsWithinDays) return null;
    const last = input.earnings
        ? completedDesc(input.earnings, input.today)[0]
        : undefined;
    return {
        kind: 'nextEarnings',
        date,
        daysUntil,
        lastSurprisePct: last ? surprisePct(last) : null,
        lastDate: last ? last.earningsDate.slice(0, 10) : null,
    };
}

/**
 * 입력에서 기준을 넘는 사실만 뽑는다. 순서는 고정이다(현금 → 증자 → 내부자 → 공매도 →
 * 목표가 → EPS 연속 → 다음 실적) — 화면과 테스트가 같은 순서를 본다.
 */
export function buildFundamentalFacts(
    input: FundamentalFactsInput
): FundamentalFact[] {
    return [
        cashRunway(input),
        dilutionFilings(input),
        insider(input),
        shortInterest(input),
        priceTarget(input),
        epsStreak(input),
        nextEarnings(input),
    ].filter((fact): fact is FundamentalFact => fact !== null);
}

/** 색인 게이트 — 본문·메타데이터·sitemap 스탬프가 모두 이 함수 하나로 판정한다. */
export function isFundamentalIndexable(
    facts: readonly FundamentalFact[]
): boolean {
    return facts.length >= FUNDAMENTAL_INDEX_MIN_FACTS;
}
