import type {
    InsiderMetrics,
    InsiderTransaction,
    InstitutionalHolderChange,
    InstitutionalHolderChangeKind,
    InstitutionalQuarter,
    InvestorFlowsAxisId,
    InvestorFlowsComposite,
    InvestorFlowsEvidence,
    InvestorFlowsFreshness,
    InvestorFlowsLabel,
    InvestorFlowsScorecard,
    InvestorFlowsSignal,
    InvestorFlowsSignalDirection,
    InvestorFlowsSignalId,
    InvestorFlowsSignalStrength,
    InvestorFlowsSnapshot,
    InvestorFlowsSufficiency,
    LargeHolderFiling,
    OfferingFiling,
    OfferingKind,
    ProposedSale,
    ShortInterestTrend,
    InsiderTransactionType,
    SqueezeRiskComponentId,
    SqueezeRiskLevel,
    SqueezeRiskSufficiency,
    ThresholdListStatus,
} from '@y0ngha/siglens-core';
import { compareIsoDate } from './investorFlowsDates';
import type { PreviousSettlementChange } from '../model';
import { computePreviousSettlementChange } from './shortInterestChange';

/**
 * 에이전트 도구(`get_investor_flows`) 결과의 상한. 도구 결과 한도는 8,000자(`INVESTOR_FLOWS_RESULT_MAX_CHARS`)이고,
 * 봉투(`asOf`·`source`·`symbol`…)까지 합친 **도구 출력 전체**를 최악 입력으로 재도 600자 넘게 남아야 한다
 * (`getInvestorFlows.test.ts`가 최악 입력의 전체 출력 길이로 고정한다). 상한을 올리면 그 테스트가 먼저 깨진다.
 * 2026-10-16 수급 확장(Form 144·증자 공시·FTD·과열 목록·풋콜·숏스퀴즈)으로 늘어난 몫은 상위 보유 기관(10→8)과
 * 최근 내부자 거래(8→6)를 줄여 일부 갚았다.
 */
export const SUMMARY_MAX_TOP_HOLDERS = 8;
export const SUMMARY_MAX_INSIDER_TRANSACTIONS = 6;
export const SUMMARY_MAX_LARGE_HOLDERS = 3;
export const SUMMARY_MAX_SIGNALS = 5;
export const SUMMARY_MAX_QUARTERS = 2;
/** Form 144·증자 공시는 최근 5건씩(설계 §2.5). */
export const SUMMARY_MAX_PROPOSED_SALES = 5;
export const SUMMARY_MAX_OFFERINGS = 5;
/** 숏스퀴즈 점수의 상위 구성요소 수 — core가 신호 근거에 싣는 수(`SQUEEZE_SIGNAL_EVIDENCE_COMPONENTS`)와 같다. */
export const SUMMARY_MAX_SQUEEZE_COMPONENTS = 3;
const SUMMARY_NAME_MAX_CHARS = 26;
const SUMMARY_ROLE_MAX_CHARS = 16;

const STRENGTH_RANK: Readonly<Record<InvestorFlowsSignalStrength, number>> = {
    strong: 3,
    moderate: 2,
    weak: 1,
};

type NetFlow = 'IN' | 'OUT' | 'FLAT';

export interface SummaryAxis {
    readonly label: InvestorFlowsLabel;
    readonly score: number | null;
    readonly sufficiency: InvestorFlowsSufficiency;
}

export interface SummarySignal {
    readonly id: InvestorFlowsSignalId;
    readonly axis: InvestorFlowsAxisId;
    readonly direction: InvestorFlowsSignalDirection;
    readonly strength: InvestorFlowsSignalStrength;
    readonly evidence: InvestorFlowsEvidence;
}

export interface SummaryQuarter {
    readonly period: string;
    readonly complete: boolean;
    readonly holders: number;
    readonly shares: number;
    readonly newHolders: number;
    readonly increased: number;
    readonly decreased: number;
    readonly exited: number;
    readonly netShareChange: number;
    /** 부호만 읽으면 되도록 방향 라벨을 함께 둔다(순매수 IN / 순매도 OUT). */
    readonly netFlow: NetFlow;
}

export interface SummaryHolder {
    readonly name: string;
    readonly shares: number;
    readonly changePct: number | null;
    readonly change: InstitutionalHolderChangeKind;
}

export interface SummaryTransaction {
    readonly date: string;
    readonly name: string;
    readonly role: string;
    readonly type: InsiderTransactionType;
    readonly valueUsd: number | null;
}

export interface SummaryLargeHolder {
    readonly filingDate: string;
    readonly filer: string;
    readonly form: string;
    readonly percentOfClass: number | null;
}

export interface SummaryShort {
    /** 최신 결제일 공매도 잔고. 점수표(`short.metrics`) 값을 그대로 옮긴다 — 화면과 같은 숫자다. */
    readonly interest: {
        readonly settlementDate: string;
        readonly shortQty: number;
        readonly pctOfFloat: number | null;
        readonly daysToCover: number | null;
        /** 직전 결제일 대비 변화(주식 수·%). 화면 배지와 같은 함수(`computePreviousSettlementChange`)의 값이다. */
        readonly changeVsPrevious: PreviousSettlementChange | null;
        /** 최근 여러 결제일에 걸친 잔고 변화율(%, core 정의) — 직전 결제일 대비와는 다른 값이다. */
        readonly recentChangePct: number | null;
        readonly trend: ShortInterestTrend | null;
    } | null;
    readonly offExchangeVolume: {
        readonly date: string;
        readonly shortRatio: number | null;
        readonly zScore: number | null;
    } | null;
    readonly squeezeRisk: boolean;
    readonly note: string;
}

/** 13F 옵션 풋/콜 명목 비율(점수표 `institutional.metrics` 그대로). */
export interface SummaryPutCall {
    readonly period: string;
    readonly putCallValueRatio: number | null;
    readonly priorPutCallValueRatio: number | null;
    readonly note: string;
}

export interface SummaryProposedSale {
    readonly filingDate: string;
    readonly filer: string;
    readonly relationships: string;
    readonly shares: number;
    readonly valueUsd: number;
    /** Rule 10b5-1 계획에 따른 매도 예정이면 true. */
    readonly plan10b5_1: boolean;
}

export interface SummaryOffering {
    readonly filingDate: string;
    readonly form: string;
    readonly kind: OfferingKind;
}

export interface SummaryFailsToDeliver {
    /** 가장 최근 실패 결제일과 그날 수량. */
    readonly latestDate: string;
    readonly latestQty: number;
    /** 최근 창 최대값·발행주식 대비 %·기준선 대비 배수(점수표 `short.metrics`). */
    readonly peakQty: number | null;
    readonly peakPctOutstanding: number | null;
    readonly peakMultipleOfBaseline: number | null;
    readonly note: string;
}

export interface SummaryThresholdList {
    readonly listed: boolean;
    readonly consecutiveDays: number;
    readonly firstListedDate: string | null;
    readonly markets: readonly string[];
    readonly asOf: string | null;
}

export interface SummarySqueezeComponent {
    readonly id: SqueezeRiskComponentId;
    readonly value: number;
    readonly contribution: number;
}

export interface SummarySqueezeRisk {
    readonly score: number | null;
    readonly level: SqueezeRiskLevel | null;
    readonly sufficiency: SqueezeRiskSufficiency;
    /** 공매도 포지션 입력이 없어 `elevated`에서 멈췄다. */
    readonly levelCapped: boolean;
    readonly topComponents: readonly SummarySqueezeComponent[];
    readonly lastBarDate: string | null;
}

/** `get_investor_flows`가 모델과 공개 API에 내는 압축 요약의 계약. */
export interface InvestorFlowsSummary {
    readonly composite: InvestorFlowsComposite;
    readonly axes: Readonly<Record<InvestorFlowsAxisId, SummaryAxis>>;
    readonly signals: readonly SummarySignal[];
    readonly freshness: InvestorFlowsFreshness;
    readonly institutional: {
        readonly quarters: readonly SummaryQuarter[];
        readonly topHoldersPeriod: string | null;
        readonly topHolders: readonly SummaryHolder[];
        /** 13F 옵션 분기가 없으면 `null`. */
        readonly putCall: SummaryPutCall | null;
    };
    readonly insider: {
        readonly metrics: InsiderMetrics | null;
        readonly recentTransactions: readonly SummaryTransaction[];
        /** Form 144 매도 예정 신고 최근 건. `null` = 이 원천이 스냅샷에 없다(조회 실패·수집 중). */
        readonly proposedSales: readonly SummaryProposedSale[] | null;
    };
    /** `null` = 13D/13G 조회 실패(없음 `[]`과 다르다). */
    readonly largeHolders: readonly SummaryLargeHolder[] | null;
    /** 증자·희석 공시 최근 건. `null` = 이 원천이 스냅샷에 없다(조회 실패·수집 중). */
    readonly offerings: readonly SummaryOffering[] | null;
    /** `null` = FINRA 꺼짐 또는 FINRA 데이터 없음. */
    readonly short: SummaryShort | null;
    /** `null` = 결제 불이행 행이 없거나 조회 불가. */
    readonly failsToDeliver: SummaryFailsToDeliver | null;
    /** `null` = 과열 목록 플래그 꺼짐·수집 전. */
    readonly thresholdList: SummaryThresholdList | null;
    /** `null` = 가격 입력이 없어 점수를 만들지 않았다. */
    readonly squeezeRisk: SummarySqueezeRisk | null;
}

function round(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function clip(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function pctChange(now: number, prev: number | null): number | null {
    if (prev === null || prev === 0) return null;
    return round(((now - prev) / prev) * 100, 1);
}

function netFlowOf(netShareChange: number): NetFlow {
    if (netShareChange > 0) return 'IN';
    if (netShareChange < 0) return 'OUT';
    return 'FLAT';
}

function summarizeQuarter(quarter: InstitutionalQuarter): SummaryQuarter {
    return {
        period: quarter.period,
        complete: quarter.complete,
        holders: quarter.holders,
        shares: quarter.shares,
        newHolders: quarter.newHolders,
        increased: quarter.increased,
        decreased: quarter.decreased,
        exited: quarter.exited,
        netShareChange: quarter.netShareChange,
        netFlow: netFlowOf(quarter.netShareChange),
    };
}

function summarizeHolder(holder: InstitutionalHolderChange): SummaryHolder {
    return {
        name: clip(holder.filerName, SUMMARY_NAME_MAX_CHARS),
        shares: holder.shares,
        changePct: pctChange(holder.shares, holder.prevShares),
        change: holder.change,
    };
}

function summarizeTransaction(tx: InsiderTransaction): SummaryTransaction {
    return {
        date: tx.date,
        name: clip(tx.name, SUMMARY_NAME_MAX_CHARS),
        role: clip(tx.role, SUMMARY_ROLE_MAX_CHARS),
        type: tx.type,
        valueUsd: tx.value,
    };
}

function summarizeLargeHolder(filing: LargeHolderFiling): SummaryLargeHolder {
    return {
        filingDate: filing.filingDate,
        filer: clip(filing.filer, SUMMARY_NAME_MAX_CHARS),
        form: filing.form,
        percentOfClass: filing.percentOfClass,
    };
}

function compactEvidence(
    evidence: InvestorFlowsEvidence
): InvestorFlowsEvidence {
    return Object.fromEntries(
        Object.entries(evidence).map(([key, value]) => [
            key,
            value === null ? null : round(value, 2),
        ])
    );
}

function pickSignals(scorecard: InvestorFlowsScorecard): SummarySignal[] {
    const all: readonly InvestorFlowsSignal[] = [
        ...scorecard.institutional.signals,
        ...scorecard.insider.signals,
        ...scorecard.largeHolders.signals,
        ...scorecard.short.signals,
        ...scorecard.dilution.signals,
    ];
    return all
        .map((signal, index) => ({ signal, index }))
        .toSorted(
            (a, b) =>
                STRENGTH_RANK[b.signal.strength] -
                    STRENGTH_RANK[a.signal.strength] || a.index - b.index
        )
        .slice(0, SUMMARY_MAX_SIGNALS)
        .map(({ signal }) => ({
            id: signal.id,
            axis: signal.axis,
            direction: signal.direction,
            strength: signal.strength,
            evidence: compactEvidence(signal.evidence),
        }));
}

function summarizeAxis(axis: SummaryAxis): SummaryAxis {
    return {
        label: axis.label,
        score: axis.score,
        sufficiency: axis.sufficiency,
    };
}

function latestBy<T>(rows: readonly T[], key: (row: T) => string): T | null {
    return (
        rows.toSorted((a, b) => compareIsoDate(key(a), key(b))).at(-1) ?? null
    );
}

function summarizeShort(
    snapshot: InvestorFlowsSnapshot,
    scorecard: InvestorFlowsScorecard
): SummaryShort | null {
    const { shortInterest, shortVolume } = snapshot;
    if (shortInterest === null && shortVolume === null) return null;
    const latest = latestBy(shortInterest ?? [], row => row.settlementDate);
    const latestVolume = latestBy(shortVolume ?? [], row => row.date);
    const metrics = scorecard.short.metrics;
    return {
        interest:
            latest === null
                ? null
                : {
                      settlementDate: latest.settlementDate,
                      shortQty: latest.shortQty,
                      pctOfFloat: metrics.shortInterestPctFloat,
                      daysToCover: metrics.daysToCover,
                      changeVsPrevious: computePreviousSettlementChange(
                          shortInterest ?? []
                      ),
                      recentChangePct: metrics.shortInterestChangePct,
                      trend: metrics.shortInterestTrend,
                  },
        offExchangeVolume:
            latestVolume === null
                ? null
                : {
                      date: latestVolume.date,
                      shortRatio: metrics.shortVolumeRatio,
                      zScore: metrics.shortVolumeRatioZ,
                  },
        squeezeRisk: metrics.squeezeRisk,
        note: 'FINRA short volume covers off-exchange (TRF) trades only.',
    };
}

const PUT_CALL_NOTE =
    '13F option notional (underlying value, not premium); often hedges, not directional bets.';
const FTD_NOTE =
    'SEC fails-to-deliver, published ~2 weeks after each half-month. Fails are not evidence of naked short selling (SEC).';

function summarizePutCall(
    scorecard: InvestorFlowsScorecard
): SummaryPutCall | null {
    const m = scorecard.institutional.metrics;
    if (m.optionsPeriod === null) return null;
    return {
        period: m.optionsPeriod,
        putCallValueRatio:
            m.putCallValueRatio === null ? null : round(m.putCallValueRatio, 2),
        priorPutCallValueRatio:
            m.priorPutCallValueRatio === null
                ? null
                : round(m.priorPutCallValueRatio, 2),
        note: PUT_CALL_NOTE,
    };
}

function summarizeProposedSale(sale: ProposedSale): SummaryProposedSale {
    return {
        filingDate: sale.filingDate,
        filer: clip(sale.filer, SUMMARY_NAME_MAX_CHARS),
        relationships: clip(
            sale.relationships.join(', '),
            SUMMARY_ROLE_MAX_CHARS
        ),
        shares: sale.shares,
        valueUsd: sale.valueUsd,
        plan10b5_1: sale.planAdoptionDate !== null,
    };
}

function summarizeOffering(filing: OfferingFiling): SummaryOffering {
    return {
        filingDate: filing.filingDate,
        form: filing.form,
        kind: filing.kind,
    };
}

function summarizeFailsToDeliver(
    snapshot: InvestorFlowsSnapshot,
    scorecard: InvestorFlowsScorecard
): SummaryFailsToDeliver | null {
    const latest = latestBy(
        snapshot.failsToDeliver ?? [],
        row => row.settlementDate
    );
    if (latest === null) return null;
    const m = scorecard.short.metrics;
    return {
        latestDate: latest.settlementDate,
        latestQty: latest.failsQty,
        peakQty: m.failsToDeliverPeakQty,
        peakPctOutstanding:
            m.failsToDeliverPctOutstanding === null
                ? null
                : round(m.failsToDeliverPctOutstanding, 3),
        peakMultipleOfBaseline:
            m.failsToDeliverMultiple === null
                ? null
                : round(m.failsToDeliverMultiple, 1),
        note: FTD_NOTE,
    };
}

function summarizeThresholdList(
    status: ThresholdListStatus | null | undefined
): SummaryThresholdList | null {
    if (status === null || status === undefined) return null;
    return {
        listed: status.listed,
        consecutiveDays: status.consecutiveDays,
        firstListedDate: status.firstListedDate,
        markets: status.markets,
        asOf: status.asOf ?? null,
    };
}

function summarizeSqueezeRisk(
    scorecard: InvestorFlowsScorecard
): SummarySqueezeRisk | null {
    const risk = scorecard.squeezeRisk;
    if (risk === null) return null;
    return {
        score: risk.score,
        level: risk.level,
        sufficiency: risk.sufficiency,
        levelCapped: risk.levelCapped,
        topComponents: risk.components
            .slice(0, SUMMARY_MAX_SQUEEZE_COMPONENTS)
            .map(component => ({
                id: component.id,
                value: round(component.value, 2),
                contribution: component.contribution,
            })),
        lastBarDate: risk.lastBarDate,
    };
}

/**
 * 에이전트 도구 `get_investor_flows`가 모델에 주는 **압축 요약**. 모델이 계산하지 않도록 점수·라벨·공매도 비율은
 * 코드가 계산한 `scorecard`에서 그대로 옮기고, 원본 목록은 상한(`SUMMARY_MAX_*`)으로 자른다.
 *
 * FINRA 플래그가 꺼져 있으면(`snapshot.shortInterest === null`) `short` 블록은 `null`이다 — 점수표의 공매도 축도
 * `insufficient`로 와서 "없음"이 "중립"으로 읽히지 않는다. 과열 목록도 플래그가 꺼지면 스냅샷이 `null`이라 `thresholdList`가
 * `null`이다. 숏스퀴즈 점수·FTD 배수·풋/콜 비율은 점수표(core) 값을 옮길 뿐 여기서 계산하지 않는다(반올림만).
 */
export function summarizeInvestorFlows(
    snapshot: InvestorFlowsSnapshot,
    scorecard: InvestorFlowsScorecard
): InvestorFlowsSummary {
    return {
        composite: scorecard.composite,
        axes: {
            institutional: summarizeAxis(scorecard.institutional),
            insider: summarizeAxis(scorecard.insider),
            largeHolders: summarizeAxis(scorecard.largeHolders),
            short: summarizeAxis(scorecard.short),
            dilution: summarizeAxis(scorecard.dilution),
        },
        signals: pickSignals(scorecard),
        freshness: scorecard.freshness,
        institutional: {
            quarters: snapshot.institutional.quarters
                .toSorted((a, b) => compareIsoDate(b.period, a.period))
                .slice(0, SUMMARY_MAX_QUARTERS)
                .map(summarizeQuarter),
            topHoldersPeriod: snapshot.institutional.topHoldersPeriod,
            topHolders: snapshot.institutional.topHolders
                .slice(0, SUMMARY_MAX_TOP_HOLDERS)
                .map(summarizeHolder),
            putCall: summarizePutCall(scorecard),
        },
        insider: {
            metrics: scorecard.insider.metrics,
            recentTransactions: snapshot.insider.transactions
                .toSorted((a, b) => compareIsoDate(b.date, a.date))
                .slice(0, SUMMARY_MAX_INSIDER_TRANSACTIONS)
                .map(summarizeTransaction),
            proposedSales:
                snapshot.proposedSales === undefined
                    ? null
                    : snapshot.proposedSales
                          .toSorted((a, b) =>
                              compareIsoDate(b.filingDate, a.filingDate)
                          )
                          .slice(0, SUMMARY_MAX_PROPOSED_SALES)
                          .map(summarizeProposedSale),
        },
        largeHolders:
            snapshot.largeHolders === null
                ? null
                : snapshot.largeHolders
                      .toSorted((a, b) =>
                          compareIsoDate(b.filingDate, a.filingDate)
                      )
                      .slice(0, SUMMARY_MAX_LARGE_HOLDERS)
                      .map(summarizeLargeHolder),
        offerings:
            snapshot.offerings === undefined
                ? null
                : snapshot.offerings
                      .toSorted((a, b) =>
                          compareIsoDate(b.filingDate, a.filingDate)
                      )
                      .slice(0, SUMMARY_MAX_OFFERINGS)
                      .map(summarizeOffering),
        short: summarizeShort(snapshot, scorecard),
        failsToDeliver: summarizeFailsToDeliver(snapshot, scorecard),
        thresholdList: summarizeThresholdList(snapshot.thresholdList),
        squeezeRisk: summarizeSqueezeRisk(scorecard),
    };
}
