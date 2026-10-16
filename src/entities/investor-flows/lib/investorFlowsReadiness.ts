import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type { InvestorFlowsPipelineReadiness, PipelineStatus } from '../model';
import { addDays } from './investorFlowsDates';
import { INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS } from './investorFlowsPolicy';

/** 상태를 읽지 못했을 때(또는 해당 없음) — 화면은 "수집 중"을 주장하지 않고 예전 동작으로 돌아간다. */
export const UNKNOWN_PIPELINE_READINESS: InvestorFlowsPipelineReadiness = {
    institutional: 'unknown',
    short: 'unknown',
    failsToDeliver: 'unknown',
    filings: 'unknown',
    thresholdList: 'unknown',
};

/**
 * 13F(기관) 준비 상태. cusip-map 전수 한 바퀴(유니버스)와 sec-13f 초기 백필이 **둘 다** 끝나야 `ready`다 —
 * 백필 표식은 유니버스 게이트를 통과한 뒤에만 설 수 있지만, 한쪽 표식만 읽히는 일시 상태를 `ready`로 오인하지 않으려
 * 둘을 모두 확인한다.
 */
export function deriveInstitutionalStatus(markers: {
    readonly universeComplete: boolean;
    readonly backfillDone: boolean;
}): PipelineStatus {
    return markers.universeComplete && markers.backfillDone
        ? 'ready'
        : 'collecting';
}

/**
 * FINRA(공매도) 준비 상태. 플래그가 꺼져 있으면 화면이 공매도 구간을 아예 그리지 않으므로 `unknown`(해당 없음)이다.
 * 켜져 있으면 잔고·일별 거래량 둘 중 한 곳에라도 행이 하나 있어야 `ready`다.
 */
export function deriveShortStatus(input: {
    readonly finraEnabled: boolean;
    readonly hasAnyRow: boolean;
}): PipelineStatus {
    if (!input.finraEnabled) return 'unknown';
    return input.hasAnyRow ? 'ready' : 'collecting';
}

/** SEC FTD 준비 상태 — 반월 파일이 하나라도 저장됐으면 `ready`. SEC 공공 정보라 플래그가 없다. */
export function deriveFtdStatus(hasAnyProcessedFile: boolean): PipelineStatus {
    return hasAnyProcessedFile ? 'ready' : 'collecting';
}

/**
 * Form 144·증자 공시 준비 상태. 커서는 백필 시작일부터 앞으로 나아가므로, 오늘에서 `INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS`일
 * 안까지 따라잡아야 `ready`다 — 그 전에는 최근 공시가 아직 비어 있을 수 있다. 커서가 없으면(첫 실행 전) `collecting`.
 */
export function deriveFilingsStatus(
    cursor: string | null,
    today: string
): PipelineStatus {
    if (cursor === null) return 'collecting';
    return cursor >= addDays(today, -INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS)
        ? 'ready'
        : 'collecting';
}

/** Reg SHO 과열 목록 준비 상태. 플래그가 꺼져 있으면 화면이 배지를 그리지 않으므로 `unknown`(해당 없음). */
export function deriveThresholdListStatus(input: {
    readonly regShoEnabled: boolean;
    readonly hasIngestedDate: boolean;
}): PipelineStatus {
    if (!input.regShoEnabled) return 'unknown';
    return input.hasIngestedDate ? 'ready' : 'collecting';
}

/**
 * 아직 수집 중인 구간을 core 계약의 "조회 불가"로 바꾼다 — 빈 배열(`[]`)은 "조회했더니 없음"으로 읽혀 AI·에이전트가
 * "공매도 활동 없음"·"증자 공시 없음"이라고 말할 수 있다. 데이터가 이미 있는 구간은 건드리지 않는다.
 *
 * - 공매도(FINRA)·FTD: `null`(core: 꺼진 피드처럼 빠진다). 과열 목록은 첫 목록을 받기 전이면 이미 `null`이라 할 일이 없다.
 * - Form 144·증자 공시: 필드를 뺀다(core 타입에 `null`이 없다 — 없는 필드는 "이 원천이 없던 옛 스냅샷"으로 보고 채점하지 않는다).
 * - 기관(13F)은 core 스냅샷이 `null`을 표현하지 못해(비널 `institutional`) 이 방식으로 가릴 수 없다 — core가 빈 분기 목록을
 *   "NO DATA(중립 아님)"로 렌더하는 것에 맡긴다.
 */
export function maskUncollectedSections(
    snapshot: InvestorFlowsSnapshot,
    readiness: InvestorFlowsPipelineReadiness
): InvestorFlowsSnapshot {
    const shortCollecting =
        readiness.short === 'collecting' &&
        (snapshot.shortInterest?.length ?? 0) === 0 &&
        (snapshot.shortVolume?.length ?? 0) === 0;
    const ftdCollecting =
        readiness.failsToDeliver === 'collecting' &&
        (snapshot.failsToDeliver?.length ?? 0) === 0;
    const proposedSalesCollecting =
        readiness.filings === 'collecting' &&
        (snapshot.proposedSales?.length ?? 0) === 0;
    const offeringsCollecting =
        readiness.filings === 'collecting' &&
        (snapshot.offerings?.length ?? 0) === 0;
    if (
        !shortCollecting &&
        !ftdCollecting &&
        !proposedSalesCollecting &&
        !offeringsCollecting
    ) {
        return snapshot;
    }
    const { proposedSales, offerings, ...rest } = snapshot;
    return {
        ...rest,
        ...(shortCollecting ? { shortInterest: null, shortVolume: null } : {}),
        ...(ftdCollecting ? { failsToDeliver: null } : {}),
        ...(proposedSalesCollecting || proposedSales === undefined
            ? {}
            : { proposedSales }),
        ...(offeringsCollecting || offerings === undefined
            ? {}
            : { offerings }),
    };
}

export interface CollectingArms {
    /** 13F 구간이 비어 있고 초기 수집이 아직 안 끝났다. */
    readonly institutional: boolean;
    /** FINRA가 켜져 있고 공매도 구간이 비어 있으며 첫 수집이 아직 안 끝났다. */
    readonly short: boolean;
    /** FTD 구간이 비어 있고 첫 파일이 아직 저장되지 않았다. */
    readonly failsToDeliver: boolean;
    /** Form 144 구간이 비어 있고 공시 수집이 최근까지 따라잡지 못했다. */
    readonly proposedSales: boolean;
    /** 증자·희석 공시 구간이 비어 있고 공시 수집이 최근까지 따라잡지 못했다. */
    readonly offerings: boolean;
    /** 과열 목록 플래그가 켜져 있고 첫 목록을 아직 받지 못했다(상태가 없다). */
    readonly thresholdList: boolean;
}

/** `resolveCollectingArms`가 읽는 스냅샷 필드 — 스냅샷이 없을 때도 호출부가 빈 값으로 채워 넘긴다. */
export type CollectingSnapshotFields = Pick<
    InvestorFlowsSnapshot,
    | 'institutional'
    | 'shortInterest'
    | 'shortVolume'
    | 'failsToDeliver'
    | 'proposedSales'
    | 'offerings'
    | 'thresholdList'
>;

/**
 * 이 종목의 어느 구간이 "데이터 없음"이 아니라 "아직 수집 중"으로 말해야 하는지 — 화면(`InvestorFlowsContent`)과 에이전트
 * 도구(`dataStatus`)가 같은 판정을 쓰도록 한 곳에 둔다. **구간이 실제로 비어 있을 때만** 참이다: 준비 상태 캐시가 낡았어도
 * 이미 있는 데이터를 "수집 중"이라고 가리지 않고, `ready`·`unknown`이면 항상 거짓이다(예전 동작).
 */
export function resolveCollectingArms(input: {
    readonly readiness: InvestorFlowsPipelineReadiness;
    readonly snapshot: CollectingSnapshotFields;
    readonly finraEnabled: boolean;
    /** Reg SHO 플래그 — 꺼져 있으면 과열 목록은 수집 중이 아니다(공매도의 `finraEnabled`와 같은 역할, 낡은 준비 상태 캐시 방어). */
    readonly regShoEnabled: boolean;
}): CollectingArms {
    const { readiness, snapshot } = input;
    const hasInstitutional =
        snapshot.institutional.quarters.length > 0 ||
        snapshot.institutional.topHolders.length > 0;
    const hasShort =
        (snapshot.shortInterest?.length ?? 0) > 0 ||
        (snapshot.shortVolume?.length ?? 0) > 0;
    return {
        institutional:
            readiness.institutional === 'collecting' && !hasInstitutional,
        short:
            input.finraEnabled && readiness.short === 'collecting' && !hasShort,
        failsToDeliver:
            readiness.failsToDeliver === 'collecting' &&
            (snapshot.failsToDeliver?.length ?? 0) === 0,
        proposedSales:
            readiness.filings === 'collecting' &&
            (snapshot.proposedSales?.length ?? 0) === 0,
        offerings:
            readiness.filings === 'collecting' &&
            (snapshot.offerings?.length ?? 0) === 0,
        thresholdList:
            input.regShoEnabled &&
            readiness.thresholdList === 'collecting' &&
            (snapshot.thresholdList ?? null) === null,
    };
}

/** 스냅샷이 없는 종목(`null`)의 판정 입력 — 모든 구간이 비어 있다. */
export const EMPTY_COLLECTING_SNAPSHOT: CollectingSnapshotFields = {
    institutional: { quarters: [], topHolders: [], topHoldersPeriod: null },
    shortInterest: [],
    shortVolume: [],
    failsToDeliver: [],
    proposedSales: [],
    offerings: [],
    thresholdList: null,
};
