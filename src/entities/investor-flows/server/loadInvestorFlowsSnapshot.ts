import { toUtcIsoDate } from '@/shared/lib/isoDate';
import type {
    InvestorFlowsFmpProvider,
    RawSharesFloat,
} from '@/shared/api/fmp/investorFlowsProvider.types';
import {
    INVESTOR_FLOWS_INSIDER_LOOKBACK_DAYS,
    INVESTOR_FLOWS_LARGE_HOLDER_FETCH_LIMIT,
} from '@/shared/api/fmp/CachedInvestorFlowsFmpProvider';
import type {
    InvestorFlowsDataProvider,
    InvestorFlowsSnapshot,
} from '@y0ngha/siglens-core';
import type {
    FtdPointRecord,
    OfferingRecord,
    OptionAggregateRecord,
    ProposedSaleRecord,
    ThresholdListingRecord,
    ThresholdStatusSummary,
} from '../model';
import {
    assembleInvestorFlowsSnapshot,
    FTD_LOOKBACK_DAYS,
    OFFERING_LOOKBACK_DAYS,
    PROPOSED_SALE_LOOKBACK_DAYS,
    SNAPSHOT_MAX_EXITED_HOLDERS,
    SNAPSHOT_MAX_OFFERINGS,
    SNAPSHOT_MAX_PROPOSED_SALES,
    SNAPSHOT_MAX_QUARTERS,
    SNAPSHOT_MAX_SHORT_INTEREST_POINTS,
    SNAPSHOT_MAX_SHORT_VOLUME_POINTS,
    SNAPSHOT_MAX_TOP_HOLDERS,
    type AggregateRecord,
    type HolderRecord,
    type ShortInterestRecord,
    type ShortVolumeRecord,
} from '../lib/investorFlowsSnapshot';
import {
    addDays,
    isPeriodComplete,
    positionsRetentionFloor,
} from '../lib/investorFlowsDates';
import { INVESTOR_FLOWS_REG_SHO_RETENTION_DAYS } from '../lib/investorFlowsPolicy';
import { summarizeThresholdListings } from '../lib/regShoParsers';

export interface InvestorFlowsSnapshotReads {
    findCusipsBySymbol(symbol: string): Promise<string[]>;
    findAggregates(cusip: string, limit: number): Promise<AggregateRecord[]>;
    findLatestPositionPeriod(cusip: string): Promise<string | null>;
    findTopHolders(
        cusip: string,
        period: string,
        limit: number
    ): Promise<HolderRecord[]>;
    findExitedHolders(
        cusip: string,
        period: string,
        limit: number,
        requireFiled: boolean
    ): Promise<HolderRecord[]>;
    findShortInterest(
        symbol: string,
        limit: number
    ): Promise<ShortInterestRecord[]>;
    findShortVolume(
        symbol: string,
        limit: number
    ): Promise<ShortVolumeRecord[]>;
    findOptionAggregates(
        cusip: string,
        limit: number
    ): Promise<OptionAggregateRecord[]>;
    findFailsToDeliver(
        symbol: string,
        sinceDate: string
    ): Promise<FtdPointRecord[]>;
    findProposedSales(
        symbol: string,
        sinceDate: string,
        limit: number
    ): Promise<ProposedSaleRecord[]>;
    findOfferings(
        symbol: string,
        sinceDate: string,
        limit: number
    ): Promise<OfferingRecord[]>;
    findThresholdListings(
        symbol: string,
        sinceDate: string
    ): Promise<ThresholdListingRecord[]>;
    /** 과열 목록을 받은 거래일들(등재 연속 일수의 분모). */
    listThresholdTradeDates(sinceDate: string): Promise<string[]>;
}

export interface InvestorFlowsSnapshotDeps {
    reads: InvestorFlowsSnapshotReads;
    fmp: InvestorFlowsFmpProvider;
    /**
     * FINRA 꺼짐이면 공매도 필드는 DB를 읽지 않고 `null`이다. FINRA 데이터는 비상업 전용 약관이라
     * 상업화 전에 꺼야 한다 — `shared/api/finra/finraShortDataEnabled.ts`, 이슈 #1042.
     */
    isFinraEnabled: () => boolean;
    /**
     * Reg SHO 과열 목록 플래그. 꺼짐이면 DB를 읽지 않고 `thresholdList: null`이다(거래소 데이터 비상업 라이선스 —
     * `shared/api/exchange/regShoThresholdDataEnabled.ts`, 이슈 #1042).
     */
    isRegShoEnabled: () => boolean;
    now: () => Date;
    log: (message: string, detail?: unknown) => void;
}

/**
 * 13F 구간. 상위 보유 기관은 **가장 최근 완결 분기**를 기준으로 뽑는다 — core는 합의도(consensus)를
 * 점수에 쓰는 분기와 `topHoldersPeriod`가 같을 때만 채점하고(진행 중 분기와 비교하면 아직 제출 안 한 기관이
 * 거짓 청산으로 보인다), 우리 집계도 완결 분기에서만 믿을 만하다. 완결 분기가 하나도 없을 때만 포지션이
 * 남은 가장 최근 분기로 되돌아간다.
 *
 * 선택한 분기에 이전 분기 비교 기준이 없으면(집계의 변화 열이 NULL) `topHoldersPeriod`를 `null`로 준다 —
 * 모든 기관이 "신규"로 보이는 거짓 합의도를 core가 채점하지 않게 한다. 목록 자체는 그대로 낸다.
 */
async function loadInstitutional(
    reads: InvestorFlowsSnapshotReads,
    symbol: string,
    today: string,
    log: InvestorFlowsSnapshotDeps['log']
): Promise<{
    aggregates: AggregateRecord[];
    topHolders: HolderRecord[];
    exitedHolders: HolderRecord[];
    topHoldersPeriod: string | null;
    optionAggregates: OptionAggregateRecord[] | null;
}> {
    const empty = {
        topHolders: [] as HolderRecord[],
        exitedHolders: [] as HolderRecord[],
        topHoldersPeriod: null,
    };
    const [cusip] = await reads.findCusipsBySymbol(symbol);
    if (cusip === undefined)
        return { aggregates: [], optionAggregates: [], ...empty };
    const [aggregates, optionAggregates] = await Promise.all([
        reads.findAggregates(cusip, SNAPSHOT_MAX_QUARTERS),
        // 옵션 집계는 부가 정보 — 실패하면 필드를 빼고(core: 옛 스냅샷처럼 채점하지 않음) 나머지 13F는 그대로 낸다.
        reads
            .findOptionAggregates(cusip, SNAPSHOT_MAX_QUARTERS)
            .catch((error: unknown): null => {
                log(
                    '[investor-flows] 13F option aggregates failed, continuing without:',
                    error
                );
                return null;
            }),
    ]);
    const floor = positionsRetentionFloor(today);
    const latestComplete = aggregates
        .filter(a => isPeriodComplete(a.period, today) && a.period >= floor)
        .map(a => a.period)
        .sort()
        .at(-1);
    const period =
        latestComplete ?? (await reads.findLatestPositionPeriod(cusip));
    if (period === null) return { aggregates, optionAggregates, ...empty };
    const [topHolders, exitedHolders] = await Promise.all([
        reads.findTopHolders(cusip, period, SNAPSHOT_MAX_TOP_HOLDERS),
        // 완결 분기는 직전 분기 전체 대비(집계의 exited와 같은 정의), 진행 중 분기는 제출한 필러만.
        reads.findExitedHolders(
            cusip,
            period,
            SNAPSHOT_MAX_EXITED_HOLDERS,
            !isPeriodComplete(period, today)
        ),
    ]);
    const hasBaseline =
        aggregates.find(a => a.period === period)?.newHolders != null;
    return {
        aggregates,
        topHolders,
        exitedHolders,
        topHoldersPeriod: hasBaseline ? period : null,
        optionAggregates,
    };
}

/** 부가 원천(FTD·Form 144·증자·과열 목록) 한 갈래의 실패를 `null`로 낮춘다 — 섹션 단위 degrade(스냅샷은 살린다). */
function degradeToNull<T>(
    promise: Promise<T>,
    label: string,
    log: InvestorFlowsSnapshotDeps['log']
): Promise<T | null> {
    return promise.catch((error: unknown): null => {
        log(`[investor-flows] ${label} failed, continuing without:`, error);
        return null;
    });
}

/** 과열 목록 상태 — 플래그가 꺼져 있으면 DB를 읽지 않는다. 보존 기간(180일) 전체를 읽어야 연속 일수가 맞다. */
async function loadThresholdSummary(
    reads: InvestorFlowsSnapshotReads,
    symbol: string,
    today: string
): Promise<ThresholdStatusSummary> {
    const since = addDays(today, -INVESTOR_FLOWS_REG_SHO_RETENTION_DAYS);
    const [listings, tradeDates] = await Promise.all([
        reads.findThresholdListings(symbol, since),
        reads.listThresholdTradeDates(since),
    ]);
    return summarizeThresholdListings(listings, tradeDates);
}

/**
 * 심볼의 수급 스냅샷을 DB(13F·FINRA·SEC FTD·Form 144·증자 공시·13F 옵션·Reg SHO)와 FMP(내부자·13D/G·유통주식수)에서
 * 조립한다.
 *
 * 인프라 실패(DB·FMP 던짐)는 그대로 던진다 — "던짐 = 장애, `null` = 이 종목은 데이터가 없다"를
 * resilient 로더가 구분한다. 유통주식수·13D/G(`largeHolders: null`)·내부자 통계(`[]`)와 확장 원천(FTD `null`, Form 144·증자·
 * 옵션은 필드 생략, 과열 목록 `null`)은 부가 정보라 실패해도 그 갈래만 degrade하고 계속한다.
 */
export async function loadInvestorFlowsSnapshot(
    rawSymbol: string,
    deps: InvestorFlowsSnapshotDeps
): Promise<InvestorFlowsSnapshot | null> {
    const symbol = rawSymbol.toUpperCase();
    const finraShortDataEnabled = deps.isFinraEnabled();
    const regShoEnabled = deps.isRegShoEnabled();
    const today = toUtcIsoDate(deps.now());

    const [
        institutional,
        insiderTrades,
        insiderStats,
        beneficialOwnership,
        sharesFloat,
        shortInterest,
        shortVolume,
        failsToDeliver,
        proposedSales,
        offerings,
        thresholdList,
    ] = await Promise.all([
        loadInstitutional(deps.reads, symbol, today, deps.log),
        deps.fmp.getInsiderTrades(symbol, INVESTOR_FLOWS_INSIDER_LOOKBACK_DAYS),
        // 통계는 부가 정보(core가 채점에 쓰지 않는다) — 실패해도 스냅샷을 죽이지 않고 `[]`로 degrade한다.
        deps.fmp.getInsiderStatistics(symbol).catch((error: unknown): [] => {
            deps.log(
                '[investor-flows] insider statistics failed, continuing without:',
                error
            );
            return [];
        }),
        // 13D/G 실패는 스냅샷 전체를 죽이지 않는다 — `null`("조회 불가")로 전달해 core가 "없음(`[]`)"과
        // 구분하게 한다(없다고 거짓으로 말하지 않는다).
        deps.fmp
            .getBeneficialOwnership(
                symbol,
                INVESTOR_FLOWS_LARGE_HOLDER_FETCH_LIMIT
            )
            .catch((error: unknown): null => {
                deps.log(
                    '[investor-flows] 13D/G fetch failed, largeHolders=null:',
                    error
                );
                return null;
            }),
        deps.fmp
            .getSharesFloat(symbol)
            .catch((error: unknown): RawSharesFloat | null => {
                deps.log(
                    '[investor-flows] shares-float failed, continuing without it:',
                    error
                );
                return null;
            }),
        finraShortDataEnabled
            ? deps.reads.findShortInterest(
                  symbol,
                  SNAPSHOT_MAX_SHORT_INTEREST_POINTS
              )
            : Promise.resolve(null),
        finraShortDataEnabled
            ? deps.reads.findShortVolume(
                  symbol,
                  SNAPSHOT_MAX_SHORT_VOLUME_POINTS
              )
            : Promise.resolve(null),
        // SEC FTD·Form 144·증자 공시는 공공 정보라 플래그가 없다. 과열 목록만 거래소 라이선스 플래그를 따른다.
        degradeToNull(
            deps.reads.findFailsToDeliver(
                symbol,
                addDays(today, -FTD_LOOKBACK_DAYS)
            ),
            'fails-to-deliver',
            deps.log
        ),
        degradeToNull(
            deps.reads.findProposedSales(
                symbol,
                addDays(today, -PROPOSED_SALE_LOOKBACK_DAYS),
                SNAPSHOT_MAX_PROPOSED_SALES
            ),
            'Form 144',
            deps.log
        ),
        degradeToNull(
            deps.reads.findOfferings(
                symbol,
                addDays(today, -OFFERING_LOOKBACK_DAYS),
                SNAPSHOT_MAX_OFFERINGS
            ),
            'offering filings',
            deps.log
        ),
        regShoEnabled
            ? degradeToNull(
                  loadThresholdSummary(deps.reads, symbol, today),
                  'Reg SHO threshold list',
                  deps.log
              )
            : Promise.resolve(null),
    ]);

    return assembleInvestorFlowsSnapshot({
        now: deps.now(),
        aggregates: institutional.aggregates,
        topHolders: institutional.topHolders,
        exitedHolders: institutional.exitedHolders,
        topHoldersPeriod: institutional.topHoldersPeriod,
        insiderTrades,
        insiderStats,
        beneficialOwnership,
        sharesFloat,
        shortInterest,
        shortVolume,
        failsToDeliver,
        proposedSales,
        offerings,
        optionAggregates: institutional.optionAggregates,
        thresholdList,
    });
}

/** `InvestorFlowsDataProvider` 포트 구현 — 의존을 주입받는다. 실제 의존은 `getInvestorFlowsDataProvider`가 구성한다. */
export class DbFmpInvestorFlowsDataProvider implements InvestorFlowsDataProvider {
    constructor(private readonly deps: InvestorFlowsSnapshotDeps) {}

    getInvestorFlowsSnapshot(
        symbol: string
    ): Promise<InvestorFlowsSnapshot | null> {
        return loadInvestorFlowsSnapshot(symbol, this.deps);
    }
}
