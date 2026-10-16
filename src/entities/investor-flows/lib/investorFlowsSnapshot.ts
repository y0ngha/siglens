import type {
    RawBeneficialOwnership,
    RawInsiderStatistic,
    RawInsiderTrade,
    RawSharesFloat,
} from '@/shared/api/fmp/investorFlowsProvider.types';
import type {
    FailsToDeliverPoint,
    InsiderStatistics,
    InsiderTransaction,
    InstitutionalHolderChange,
    InstitutionalHolderChangeKind,
    InstitutionalOptionsQuarter,
    InstitutionalQuarter,
    LargeHolderFiling,
    InvestorFlowsSnapshot,
    OfferingFiling,
    ProposedSale,
    ShortInterestPoint,
    ShortVolumePoint,
    ThresholdListStatus,
} from '@y0ngha/siglens-core';
import type {
    FtdPointRecord,
    OfferingRecord,
    OptionAggregateRecord,
    ProposedSaleRecord,
    ThresholdStatusSummary,
} from '../model';
import {
    addDays,
    compareIsoDate,
    isPeriodComplete,
} from './investorFlowsDates';

/** 스냅샷에 담는 상한 — 화면·프롬프트 크기를 묶는다. */
export const SNAPSHOT_MAX_QUARTERS = 8;
export const SNAPSHOT_MAX_TOP_HOLDERS = 25;
export const SNAPSHOT_MAX_EXITED_HOLDERS = 5;
/** 12개월치 Form 4(대형주는 수백 건 — 대부분 `other`). */
export const SNAPSHOT_MAX_INSIDER_TRANSACTIONS = 600;
export const SNAPSHOT_MAX_INSIDER_STAT_QUARTERS = 8;
export const SNAPSHOT_MAX_LARGE_HOLDERS = 60;
/** 13D/G는 약 2년치만 담는다(core 계약). */
export const LARGE_HOLDER_WINDOW_DAYS = 730;
export const SNAPSHOT_MAX_SHORT_INTEREST_POINTS = 12;
export const SNAPSHOT_MAX_SHORT_VOLUME_POINTS = 120;
/**
 * FTD를 읽는 창(일). core는 최근 30일(`FTD_RECENT_WINDOW_DAYS`)과 그 앞 60일 기준선(`FTD_BASELINE_WINDOW_DAYS`)을 보므로
 * 90일이면 판정에 충분하고, 화면 막대 그래프도 같은 창을 쓴다. 여유 30일은 SEC 게시 지연(약 2주)과 반월 경계 몫이다.
 */
export const FTD_LOOKBACK_DAYS = 120;
/** FTD 행은 실패가 있던 결제일에만 있다 — 120일 창의 거래일 수(약 84)를 넘지 않는다. */
export const SNAPSHOT_MAX_FTD_POINTS = 90;
/** Form 144는 약 1년치(core 계약, 저장 보존 기간과 같다). 대형주도 1년 수십 건이다. */
export const PROPOSED_SALE_LOOKBACK_DAYS = 365;
export const SNAPSHOT_MAX_PROPOSED_SALES = 60;
/** 증자·희석 공시는 약 2년치(core 계약). */
export const OFFERING_LOOKBACK_DAYS = 730;
export const SNAPSHOT_MAX_OFFERINGS = 40;

/** DB에서 읽은 분기 집계 한 행(변화 열은 이전 분기 기준이 없으면 null). */
export interface AggregateRecord {
    period: string;
    holders: number;
    shares: number;
    valueUsd: number;
    newHolders: number | null;
    increased: number | null;
    decreased: number | null;
    exited: number | null;
    netShareChange: number | null;
}

/** 최신 분기 보유 기관 한 행(이전 분기 수량 포함). `cur`이 없으면 청산(exited)이다. */
export interface HolderRecord {
    cik: string;
    filerName: string;
    shares: number;
    valueUsd: number;
    prevShares: number | null;
}

export interface ShortInterestRecord {
    settlementDate: string;
    shortQty: number;
    avgDailyVolume: number | null;
    daysToCover: number | null;
}

export interface ShortVolumeRecord {
    tradeDate: string;
    shortVolume: number;
    totalVolume: number;
}

/** 이전 분기 기준(baseline)이 있어 변화 열이 모두 채워진 집계인가. */
function hasBaselineChanges(row: AggregateRecord): row is AggregateRecord & {
    newHolders: number;
    increased: number;
    decreased: number;
    exited: number;
    netShareChange: number;
} {
    return (
        row.newHolders !== null &&
        row.increased !== null &&
        row.decreased !== null &&
        row.exited !== null &&
        row.netShareChange !== null
    );
}

/**
 * 분기 집계 → core `InstitutionalQuarter`. **이전 분기 기준이 없는 분기(변화 열 NULL)는 통째로 뺀다** —
 * core 타입은 변화 필드를 숫자로 요구하고 `0`은 "변화 없음"으로 읽히므로, 비교 대상이 없다는 사실이
 * 중립 신호로 둔갑하면 안 된다(없음은 중립이 아니다). 그 분기의 보유 기관 수는 다음 분기의
 * `holders − newHolders + exited` 항등식으로 core가 복원한다.
 */
export function buildInstitutionalQuarters(
    aggregates: readonly AggregateRecord[],
    today: string
): InstitutionalQuarter[] {
    return aggregates
        .filter(hasBaselineChanges)
        .sort((a, b) =>
            a.period < b.period ? -1 : a.period > b.period ? 1 : 0
        )
        .slice(-SNAPSHOT_MAX_QUARTERS)
        .map(row => ({
            period: row.period,
            complete: isPeriodComplete(row.period, today),
            holders: row.holders,
            shares: row.shares,
            valueUsd: row.valueUsd,
            newHolders: row.newHolders,
            increased: row.increased,
            decreased: row.decreased,
            exited: row.exited,
            netShareChange: row.netShareChange,
        }));
}

function classify(
    shares: number,
    prevShares: number | null
): InstitutionalHolderChangeKind {
    if (shares === 0) return 'exited';
    if (prevShares === null) return 'new';
    if (shares > prevShares) return 'increased';
    if (shares < prevShares) return 'decreased';
    return 'unchanged';
}

/**
 * 최신 분기의 상위 보유 기관(수량 내림차순) + 청산한 상위 기관을 변화 종류와 함께 낸다.
 * `exitedHolders`는 이전 분기엔 있었고 이번 분기엔 보고하고도 보유하지 않은 기관이다.
 */
export function buildTopHolders(
    topHolders: readonly HolderRecord[],
    exitedHolders: readonly HolderRecord[]
): InstitutionalHolderChange[] {
    const held = topHolders
        .slice(0, SNAPSHOT_MAX_TOP_HOLDERS)
        .map<InstitutionalHolderChange>(row => ({
            filerName: row.filerName,
            cik: row.cik,
            shares: row.shares,
            valueUsd: row.valueUsd,
            prevShares: row.prevShares,
            change: classify(row.shares, row.prevShares),
        }));
    const exited = exitedHolders
        .slice(0, SNAPSHOT_MAX_EXITED_HOLDERS)
        .map<InstitutionalHolderChange>(row => ({
            filerName: row.filerName,
            cik: row.cik,
            shares: 0,
            valueUsd: 0,
            prevShares: row.prevShares,
            change: 'exited',
        }));
    return [...held, ...exited];
}

function finiteNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}

function nonNegative(value: unknown): number | null {
    const n = finiteNumber(value);
    return n !== null && n >= 0 ? n : null;
}

function isIsoDate(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);
}

/** FMP `transactionType` → 매수/매도/기타. `P-Purchase`만 매수, `S-Sale`(+`S-Sale+OE`)만 매도다. */
export function mapInsiderTransactionType(
    raw: string | null | undefined
): InsiderTransaction['type'] {
    if (raw?.startsWith('P-Purchase')) return 'buy';
    if (raw?.startsWith('S-Sale')) return 'sell';
    return 'other';
}

export function buildInsiderTransactions(
    rows: readonly RawInsiderTrade[]
): InsiderTransaction[] {
    const mapped: InsiderTransaction[] = [];
    for (const row of rows) {
        const shares = finiteNumber(row.securitiesTransacted);
        if (
            !isIsoDate(row.transactionDate) ||
            !isIsoDate(row.filingDate) ||
            shares === null ||
            shares <= 0
        ) {
            continue;
        }
        const price = finiteNumber(row.price);
        const validPrice = price !== null && price > 0 ? price : null;
        mapped.push({
            date: row.transactionDate.slice(0, 10),
            filingDate: row.filingDate.slice(0, 10),
            name: row.reportingName ?? '',
            role: row.typeOfOwner ?? '',
            type: mapInsiderTransactionType(row.transactionType),
            shares,
            price: validPrice,
            value: validPrice === null ? null : Math.round(shares * validPrice),
            sharesOwnedAfter: nonNegative(row.securitiesOwned),
            url: row.url ?? '',
        });
    }
    return mapped
        .sort((a, b) =>
            a.date !== b.date
                ? a.date < b.date
                    ? 1
                    : -1
                : a.filingDate < b.filingDate
                  ? 1
                  : a.filingDate > b.filingDate
                    ? -1
                    : 0
        )
        .slice(0, SNAPSHOT_MAX_INSIDER_TRANSACTIONS);
}

/** 분기 번호 → 그 분기 말일(`yyyy-mm-dd`). */
const QUARTER_END = ['03-31', '06-30', '09-30', '12-31'] as const;

export function buildInsiderStats(
    rows: readonly RawInsiderStatistic[]
): InsiderStatistics[] {
    const mapped: InsiderStatistics[] = [];
    for (const row of rows) {
        const year = finiteNumber(row.year);
        const quarter = finiteNumber(row.quarter);
        const end = quarter === null ? undefined : QUARTER_END[quarter - 1];
        if (year === null || end === undefined) continue;
        mapped.push({
            period: `${year}-${end}`,
            acquiredTransactions: finiteNumber(row.acquiredTransactions) ?? 0,
            disposedTransactions: finiteNumber(row.disposedTransactions) ?? 0,
            totalAcquired: finiteNumber(row.totalAcquired) ?? 0,
            totalDisposed: finiteNumber(row.totalDisposed) ?? 0,
        });
    }
    return mapped
        .sort((a, b) =>
            a.period < b.period ? 1 : a.period > b.period ? -1 : 0
        )
        .slice(0, SNAPSHOT_MAX_INSIDER_STAT_QUARTERS)
        .reverse();
}

/**
 * **대체 경로 전용** — SEC 제출 목록 조회가 실패했을 때만 5% 대량보유 공시의 양식을 URL에서 추정한다(정상
 * 경로는 `RawBeneficialOwnership.form`의 정확한 값이다). 새 EDGAR 형식(`xslSCHEDULE_13G_X02`)과 옛 파일명
 * (`sc13ga.htm`)은 `13D`/`13G` 토큰을 담지만 **정정(`/A`) 여부는 알 수 없어** 붙이지 않는다. 토큰이 없으면
 * `unknown`(core는 이런 행을 건너뛴다).
 */
export function inferLargeHolderForm(url: string | null | undefined): string {
    if (!url) return 'unknown';
    if (/13d/i.test(url)) return 'SC 13D';
    if (/13g/i.test(url)) return 'SC 13G';
    return 'unknown';
}

export function buildLargeHolders(
    rows: readonly RawBeneficialOwnership[],
    today: string
): LargeHolderFiling[] {
    const cutoff = addDays(today, -LARGE_HOLDER_WINDOW_DAYS);
    const mapped: LargeHolderFiling[] = [];
    for (const row of rows) {
        if (
            !isIsoDate(row.filingDate) ||
            row.filingDate.slice(0, 10) < cutoff
        ) {
            continue;
        }
        mapped.push({
            filingDate: row.filingDate.slice(0, 10),
            filer: row.nameOfReportingPerson ?? '',
            form:
                row.form ??
                (row.formLookupFailed
                    ? inferLargeHolderForm(row.url)
                    : 'unknown'),
            percentOfClass: finiteNumber(row.percentOfClass),
            shares: finiteNumber(row.amountBeneficiallyOwned),
            url: row.url ?? '',
        });
    }
    return mapped
        .sort((a, b) =>
            a.filingDate < b.filingDate
                ? 1
                : a.filingDate > b.filingDate
                  ? -1
                  : 0
        )
        .slice(0, SNAPSHOT_MAX_LARGE_HOLDERS);
}

function ascendingTail<T>(
    rows: readonly T[],
    key: (row: T) => string,
    max: number
): T[] {
    return [...rows]
        .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0))
        .slice(-max);
}

export function buildShortInterest(
    rows: readonly ShortInterestRecord[]
): ShortInterestPoint[] {
    return ascendingTail(
        rows,
        row => row.settlementDate,
        SNAPSHOT_MAX_SHORT_INTEREST_POINTS
    ).map(row => ({
        settlementDate: row.settlementDate,
        shortQty: row.shortQty,
        avgDailyVolume: row.avgDailyVolume,
        daysToCover: row.daysToCover,
    }));
}

export function buildShortVolume(
    rows: readonly ShortVolumeRecord[]
): ShortVolumePoint[] {
    return ascendingTail(
        rows,
        row => row.tradeDate,
        SNAPSHOT_MAX_SHORT_VOLUME_POINTS
    ).map(row => ({
        date: row.tradeDate,
        shortVolume: row.shortVolume,
        totalVolume: row.totalVolume,
    }));
}

export function buildFailsToDeliver(
    rows: readonly FtdPointRecord[]
): FailsToDeliverPoint[] {
    return ascendingTail(
        rows,
        row => row.settlementDate,
        SNAPSHOT_MAX_FTD_POINTS
    ).map(row => ({
        settlementDate: row.settlementDate,
        failsQty: row.failsQty,
        price: row.price,
    }));
}

/** 최신 신고일 먼저 — 상한으로 자를 때 오래된 쪽을 버린다. */
export function buildProposedSales(
    rows: readonly ProposedSaleRecord[]
): ProposedSale[] {
    return rows
        .toSorted((a, b) => compareIsoDate(b.filingDate, a.filingDate))
        .slice(0, SNAPSHOT_MAX_PROPOSED_SALES)
        .map(row => ({
            filingDate: row.filingDate,
            filer: row.filer,
            relationships: row.relationships,
            shares: row.shares,
            valueUsd: row.valueUsd,
            approxSaleDate: row.approxSaleDate,
            planAdoptionDate: row.planAdoptionDate,
            url: row.url,
        }));
}

export function buildOfferings(
    rows: readonly OfferingRecord[]
): OfferingFiling[] {
    return rows
        .toSorted((a, b) => compareIsoDate(b.filingDate, a.filingDate))
        .slice(0, SNAPSHOT_MAX_OFFERINGS)
        .map(row => ({
            filingDate: row.filingDate,
            form: row.formType,
            kind: row.kind,
            url: row.url,
        }));
}

/** 분기별 13F 옵션 집계 → core 타입(오래된 분기 먼저). 진행 중 분기는 `complete: false`라 core가 채점하지 않는다. */
export function buildOptionQuarters(
    rows: readonly OptionAggregateRecord[],
    today: string
): InstitutionalOptionsQuarter[] {
    return ascendingTail(rows, row => row.period, SNAPSHOT_MAX_QUARTERS).map(
        row => ({
            period: row.period,
            complete: isPeriodComplete(row.period, today),
            putHolders: row.putHolders,
            putShares: row.putShares,
            putValueUsd: row.putValueUsd,
            callHolders: row.callHolders,
            callShares: row.callShares,
            callValueUsd: row.callValueUsd,
        })
    );
}

/**
 * 과열 목록 요약 → core 타입. 수집된 거래일이 하나도 없으면(`asOf: null`) "미등재"가 아니라 "모름"이라 `null`이다 —
 * core는 `null`을 꺼진 피드처럼 다룬다. `asOf`(목록 날짜)를 함께 넘겨 core가 낡은 상태(7일 초과)를 스스로 버리게 한다.
 */
export function buildThresholdList(
    summary: ThresholdStatusSummary
): ThresholdListStatus | null {
    if (summary.asOf === null) return null;
    return {
        listed: summary.listed,
        consecutiveDays: summary.consecutiveDays,
        firstListedDate: summary.firstListedDate,
        markets: summary.markets,
        asOf: summary.asOf,
    };
}

export interface InvestorFlowsSnapshotInput {
    now: Date;
    aggregates: readonly AggregateRecord[];
    topHolders: readonly HolderRecord[];
    exitedHolders: readonly HolderRecord[];
    insiderTrades: readonly RawInsiderTrade[];
    insiderStats: readonly RawInsiderStatistic[];
    /** `null` = 13D/G 조회 실패(없음 `[]`과 다르다) — 스냅샷 `largeHolders`도 `null`이다. */
    beneficialOwnership: readonly RawBeneficialOwnership[] | null;
    /** `topHolders`가 서술하는 분기. 상위 보유 기관이 없으면 `null`. */
    topHoldersPeriod: string | null;
    sharesFloat: RawSharesFloat | null;
    /** `null` = FINRA 꺼짐 — 스냅샷에도 `null`로 전달한다(0건과 다르다). */
    shortInterest: readonly ShortInterestRecord[] | null;
    shortVolume: readonly ShortVolumeRecord[] | null;
    /** `null` = 조회 실패(실패가 없던 날은 행이 없을 뿐이라 `[]`과 다르다). */
    failsToDeliver: readonly FtdPointRecord[] | null;
    /** `null` = 조회 실패 — 스냅샷에서 필드를 뺀다(core는 없는 필드를 "옛 스냅샷"으로 보고 채점하지 않는다). */
    proposedSales: readonly ProposedSaleRecord[] | null;
    offerings: readonly OfferingRecord[] | null;
    optionAggregates: readonly OptionAggregateRecord[] | null;
    /** `null` = Reg SHO 플래그 꺼짐 또는 조회 실패. */
    thresholdList: ThresholdStatusSummary | null;
}

/**
 * 스냅샷 조립(순수). 어떤 원천에서도 데이터가 하나도 없으면 `null` — "이 종목은 수급 데이터가 없다"를
 * 호출부가 구분할 수 있게 한다. FINRA 꺼짐(`null`)만으로는 데이터 없음이 아니다.
 */
export function assembleInvestorFlowsSnapshot(
    input: InvestorFlowsSnapshotInput
): InvestorFlowsSnapshot | null {
    const today = input.now.toISOString().slice(0, 10);
    const quarters = buildInstitutionalQuarters(input.aggregates, today);
    const transactions = buildInsiderTransactions(input.insiderTrades);
    const stats = buildInsiderStats(input.insiderStats);
    const largeHolders =
        input.beneficialOwnership === null
            ? null
            : buildLargeHolders(input.beneficialOwnership, today);
    const shortInterest =
        input.shortInterest === null
            ? null
            : buildShortInterest(input.shortInterest);
    const shortVolume =
        input.shortVolume === null ? null : buildShortVolume(input.shortVolume);
    const failsToDeliver =
        input.failsToDeliver === null
            ? null
            : buildFailsToDeliver(input.failsToDeliver);
    const proposedSales =
        input.proposedSales === null
            ? null
            : buildProposedSales(input.proposedSales);
    const offerings =
        input.offerings === null ? null : buildOfferings(input.offerings);
    const options =
        input.optionAggregates === null
            ? null
            : buildOptionQuarters(input.optionAggregates, today);
    const thresholdList =
        input.thresholdList === null
            ? null
            : buildThresholdList(input.thresholdList);

    // 과열 목록 "미등재"는 데이터가 아니다(모든 종목이 대부분 미등재) — 등재됐을 때만 데이터로 센다.
    const hasData =
        quarters.length > 0 ||
        transactions.length > 0 ||
        stats.length > 0 ||
        (largeHolders?.length ?? 0) > 0 ||
        (shortInterest?.length ?? 0) > 0 ||
        (shortVolume?.length ?? 0) > 0 ||
        (failsToDeliver?.length ?? 0) > 0 ||
        (proposedSales?.length ?? 0) > 0 ||
        (offerings?.length ?? 0) > 0 ||
        (options?.length ?? 0) > 0 ||
        thresholdList?.listed === true;
    if (!hasData) return null;

    return {
        asOf: input.now.toISOString(),
        sharesOutstanding: finiteNumber(input.sharesFloat?.outstandingShares),
        floatShares: finiteNumber(input.sharesFloat?.floatShares),
        institutional: {
            quarters,
            topHolders: buildTopHolders(input.topHolders, input.exitedHolders),
            topHoldersPeriod: input.topHoldersPeriod,
            ...(options === null ? {} : { options }),
        },
        insider: { transactions, stats },
        largeHolders,
        shortInterest,
        shortVolume,
        failsToDeliver,
        ...(proposedSales === null ? {} : { proposedSales }),
        ...(offerings === null ? {} : { offerings }),
        thresholdList,
    };
}
