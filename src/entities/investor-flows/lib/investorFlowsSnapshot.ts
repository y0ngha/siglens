import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type {
    RawBeneficialOwnership,
    RawInsiderStatistic,
    RawInsiderTrade,
    RawSharesFloat,
} from '@/shared/api/fmp/investorFlowsProvider.types';
import type {
    FtdPointRecord,
    OfferingRecord,
    OptionAggregateRecord,
    ProposedSaleRecord,
    ThresholdStatusSummary,
} from '../model';
import type { AggregateRecord, HolderRecord } from './snapshot/institutional';
import {
    buildInstitutionalQuarters,
    buildTopHolders,
    buildOptionQuarters,
} from './snapshot/institutional';
import {
    buildInsiderTransactions,
    buildInsiderStats,
} from './snapshot/insider';
import { buildLargeHolders } from './snapshot/largeHolders';
import type { ShortInterestRecord, ShortVolumeRecord } from './snapshot/short';
import {
    buildShortInterest,
    buildShortVolume,
    buildFailsToDeliver,
    buildThresholdList,
} from './snapshot/short';
import { buildProposedSales, buildOfferings } from './snapshot/filings';
import { finiteNumber } from './snapshot/snapshotRows';

/** `assembleInvestorFlowsSnapshot`의 입력 — DB 행과 외부(FMP) 원본을 한데 모은 값. */
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
            : buildProposedSales(input.proposedSales, today);
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
