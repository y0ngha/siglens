import {
    REGULAR_CLOSE_MINUTE,
    type FundamentalPriceTargetConsensusInput,
    type FundamentalPriceTargetSummaryInput,
} from '@y0ngha/siglens-core';
import { etWallClock } from '@/shared/api/market/usSessionClock';
import type {
    YahooAnalystSummary,
    YahooEstimatePeriod,
    YahooRawAnalystAction,
} from '@/shared/api/yahoo/yahooAnalystSource';
import { fractionToPct } from '@/shared/api/yahoo/yahooValues';
import { MINUTES_PER_HOUR } from '@/shared/config/time';
import { addUtcIsoDays, toUtcIsoDate } from '@/shared/lib/isoDate';
import { zonedDate } from '@/shared/lib/marketSessionDate';
import type {
    AnalystAction,
    AnalystActionKind,
    AnalystActionTally,
    AnalystEarningsHint,
    AnalystEstimatePeriod,
    AnalystFmpTargets,
    AnalystRatings,
    AnalystSource,
    AnalystTargetAction,
    AnalystViews,
    EarningsSession,
} from '../model';
import { targetGapPct, targetsDisagree } from './targetGap';

const TALLY_WINDOWS_DAYS = { last30d: 30, last90d: 90 } as const;

const EASTERN_TIME_ZONE = 'America/New_York';
/** 미국 정규장 시작 09:30 ET (자정으로부터의 분). 마감은 core의 `REGULAR_CLOSE_MINUTE`(16:00)다. */
const MARKET_OPEN_MINUTES = 9 * MINUTES_PER_HOUR + 30;

const ACTION_KINDS: Record<string, AnalystActionKind> = {
    up: 'upgrade',
    down: 'downgrade',
    main: 'maintain',
    init: 'initiate',
    reit: 'reiterate',
};

const TARGET_ACTIONS: Record<string, AnalystTargetAction> = {
    raises: 'raise',
    lowers: 'lower',
    maintains: 'maintain',
    announces: 'announce',
};

export interface BuildAnalystViewsInput {
    symbol: string;
    /** 호출자가 주입한다 — 이 파일은 시계를 읽지 않는다(EN-1). */
    now: Date;
    /** Yahoo 요약. `null`이면 조회 실패(`degraded: ['yahoo']`). */
    yahoo: YahooAnalystSummary | null;
    /** FMP 결과. 한국 종목은 조회하지 않으므로 `null`. */
    fmp: {
        consensus: FundamentalPriceTargetConsensusInput | null;
        summary: FundamentalPriceTargetSummaryInput | null;
    } | null;
    /** FMP 호출이 실패(reject)했는가. 단순히 목표가가 없는 경우는 실패가 아니다. */
    fmpFailed: boolean;
    /** 한국 종목은 변경 이력 모듈을 요청하지 않는다. */
    includeActions: boolean;
    /** 한국 종목은 실적 힌트를 내지 않는다(프로바이더가 이미 Yahoo다). */
    includeEarnings: boolean;
    /** 실적 추정치 추이를 싣는가. 가벼운 조회(`detail: 'lite'`)는 싣지 않는다. */
    includeEstimates: boolean;
}

/** 현재 − 과거(주당). 반올림은 도구 경계(`roundNumbersDeep`)가 한 번만 한다. 차이가 0이면 `-0`이 아니라 `0`이다. */
function epsChange(current: number | null, past: number | null): number | null {
    return current === null || past === null ? null : current - past || 0;
}

function mapEstimate(raw: YahooEstimatePeriod): AnalystEstimatePeriod {
    return {
        period: raw.period,
        endDate: raw.endDate,
        eps: {
            avg: raw.epsAvg,
            analysts: raw.epsAnalysts,
            ago7d: raw.eps7dAgo,
            ago30d: raw.eps30dAgo,
            ago60d: raw.eps60dAgo,
            ago90d: raw.eps90dAgo,
            change30d: epsChange(raw.epsAvg, raw.eps30dAgo),
            change90d: epsChange(raw.epsAvg, raw.eps90dAgo),
        },
        revisions: {
            up7d: raw.up7d,
            down7d: raw.down7d,
            up30d: raw.up30d,
            down30d: raw.down30d,
        },
        revenue: {
            avg: raw.revenueAvg,
            analysts: raw.revenueAnalysts,
            growthPct: fractionToPct(raw.revenueGrowth),
        },
    };
}

/**
 * EPS와 매출 추정치가 둘 다 없는 기간만 버린다(적자·초기 기업은 매출 추정치만 있을 수 있다). 남는 기간이 없으면 `null`
 * ("추정치 없음"을 빈 배열로 내지 않는다).
 */
export function buildEstimates(
    yahoo: YahooAnalystSummary | null
): AnalystEstimatePeriod[] | null {
    const periods = (yahoo?.estimates ?? [])
        .filter(row => row.epsAvg !== null || row.revenueAvg !== null)
        .map(mapEstimate);
    return periods.length > 0 ? periods : null;
}

function positiveOrNull(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : null;
}

function nonEmptyOrNull(value: string | null): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
}

function mapAction(raw: YahooRawAnalystAction): AnalystAction | null {
    const instant = validDate(raw.dateIso);
    const date = instant === null ? null : toUtcIsoDate(instant);
    const firm = nonEmptyOrNull(raw.firm);
    if (date === null || firm === null) return null;
    return {
        date,
        firm,
        action: ACTION_KINDS[raw.action?.toLowerCase() ?? ''] ?? 'maintain',
        fromGrade: nonEmptyOrNull(raw.fromGrade),
        toGrade: nonEmptyOrNull(raw.toGrade),
        priorTarget: positiveOrNull(raw.priorPriceTarget),
        target: positiveOrNull(raw.currentPriceTarget),
        targetAction:
            TARGET_ACTIONS[raw.priceTargetAction?.toLowerCase() ?? ''] ?? null,
    };
}

/** 최신순 정렬(방어적). 같은 날짜는 입력 순서를 유지한다(안정 정렬). */
function mapActions(raw: readonly YahooRawAnalystAction[]): AnalystAction[] {
    return raw
        .map(mapAction)
        .filter((row): row is AnalystAction => row !== null)
        .toSorted((a, b) => b.date.localeCompare(a.date));
}

function tallyWithin(
    rows: readonly AnalystAction[],
    fromDate: string,
    toDate: string
): AnalystActionTally {
    const inWindow = rows.filter(
        row => row.date >= fromDate && row.date <= toDate
    );
    const count = (matches: (row: AnalystAction) => boolean): number =>
        inWindow.filter(matches).length;
    return {
        upgrades: count(row => row.action === 'upgrade'),
        downgrades: count(row => row.action === 'downgrade'),
        initiations: count(row => row.action === 'initiate'),
        targetRaises: count(row => row.targetAction === 'raise'),
        targetCuts: count(row => row.targetAction === 'lower'),
    };
}

function buildRatings(
    yahoo: YahooAnalystSummary | null
): AnalystRatings | null {
    const trend = yahoo?.trend;
    if (!trend) return null;
    const analysts =
        trend.strongBuy +
        trend.buy +
        trend.hold +
        trend.sell +
        trend.strongSell;
    return analysts > 0 ? { ...trend, analysts, source: 'yahoo' } : null;
}

function buildFmpTargets(
    fmp: BuildAnalystViewsInput['fmp']
): AnalystFmpTargets | null {
    const consensus = fmp?.consensus;
    if (!consensus || consensus.targetConsensus === null) return null;
    return {
        consensus: consensus.targetConsensus,
        median: consensus.targetMedian,
        low: consensus.targetLow,
        high: consensus.targetHigh,
        // FMP 어댑터가 건수를 버리므로 알 수 없다. 평균 0은 "그 기간에 나온 목표가 없음"을 FMP가 0으로
        // 채운 것이라(실측 LAES: lastMonthAvgPriceTarget 0) 목표가 0달러로 읽히지 않게 null로 둔다.
        lastMonth: {
            count: null,
            avg: positiveOrNull(fmp?.summary?.lastMonth.avgPriceTarget),
        },
        lastQuarter: {
            count: null,
            avg: positiveOrNull(fmp?.summary?.lastQuarter.avgPriceTarget),
        },
    };
}

function sessionOf(at: Date): EarningsSession {
    // `etWallClock`은 서머타임을 규칙으로 계산한다(`Intl` 없음) — 전환일 당일도 전환 뒤 오프셋으로 읽는다.
    const { minuteOfDay } = etWallClock(at.getTime());
    if (minuteOfDay < MARKET_OPEN_MINUTES) return 'before_market';
    if (minuteOfDay >= REGULAR_CLOSE_MINUTE) return 'after_market';
    return 'during_market';
}

function validDate(iso: string | null): Date | null {
    if (iso === null) return null;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? date : null;
}

function buildEarnings(
    yahoo: YahooAnalystSummary | null,
    now: Date
): AnalystEarningsHint | null {
    const hint = yahoo?.earnings;
    const at = validDate(hint?.dateIso ?? null);
    if (!hint || at === null) return null;
    // 발표 후에도 Yahoo는 지난 날짜를 그대로 둔다 — 지난 일정은 일정이 아니다.
    if (at.getTime() < now.getTime()) return null;
    const date = zonedDate(at, EASTERN_TIME_ZONE);
    const call = validDate(hint.callDateIso);
    // 콜 날짜가 지난 분기 것으로 남아 있을 수 있어 발표일과 같은 날일 때만 싣는다.
    const callAt =
        call !== null && zonedDate(call, EASTERN_TIME_ZONE) === date
            ? call.toISOString()
            : null;
    return {
        date,
        isEstimate: hint.isEstimate,
        // 추정일의 시각은 자리표시값이라 세션으로 읽지 않는다.
        session: hint.isEstimate === false ? sessionOf(at) : null,
        callAt,
    };
}

/**
 * 출처별 원자료를 `AnalystViews`로 합친다. 순수 함수 — I/O도 시계도 없다(`now`는 인자).
 */
export function buildAnalystViews(input: BuildAnalystViewsInput): AnalystViews {
    const { symbol, now, yahoo, fmp, fmpFailed } = input;
    const yahooTargets =
        yahoo && yahoo.targets.mean !== null ? yahoo.targets : null;
    const fmpTargets = buildFmpTargets(fmp);
    const yahooMean = yahooTargets?.mean ?? null;
    const gapPct = targetGapPct(fmpTargets?.consensus, yahooMean);

    // 이력을 읽지 못했으면(요청 안 함, 또는 Yahoo 실패) 0건 집계를 내지 않는다 — "변경 없음"으로 읽히기 때문이다.
    const historyRows = input.includeActions ? yahoo?.actions : null;
    const rows = historyRows ? mapActions(historyRows) : [];
    const available = historyRows != null;
    const today = toUtcIsoDate(now);
    const tally = (days: number) =>
        tallyWithin(rows, addUtcIsoDays(today, -days), today);

    const degraded: AnalystSource[] = [
        ...(yahoo === null ? (['yahoo'] as const) : []),
        ...(fmpFailed ? (['fmp'] as const) : []),
    ];

    return {
        asOf: now.toISOString(),
        symbol,
        targets: {
            yahoo: yahooTargets,
            fmp: fmpTargets,
            gapPct,
            sourcesDisagree: targetsDisagree(gapPct),
        },
        ratings: buildRatings(yahoo),
        actions: {
            available,
            rows,
            tally: available
                ? {
                      last30d: tally(TALLY_WINDOWS_DAYS.last30d),
                      last90d: tally(TALLY_WINDOWS_DAYS.last90d),
                  }
                : null,
        },
        earnings: input.includeEarnings ? buildEarnings(yahoo, now) : null,
        estimates: input.includeEstimates ? buildEstimates(yahoo) : null,
        degraded,
    };
}
