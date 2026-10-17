import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type { InvestorFlowsPipelineReadiness, PipelineStatus } from '../model';
import { addDays, compareIsoDate } from './investorFlowsDates';
import { INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS } from './investorFlowsPolicy';

/** 상태를 읽지 못했을 때(또는 해당 없음) — 화면은 "수집 중"을 주장하지 않고 예전 동작으로 돌아간다. */
export const UNKNOWN_PIPELINE_READINESS: InvestorFlowsPipelineReadiness = {
    institutional: 'unknown',
    short: 'unknown',
    failsToDeliver: 'unknown',
    filings: 'unknown',
    thresholdList: 'unknown',
    dart: 'unknown',
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
 * 켜져 있으면 잔고·일별 거래량 둘 중 한 곳에라도 행이 있고, **유니버스가 다 찼고**(cusip-map 전수 한 바퀴) 그 뒤의 1회 재수집
 * (`finra_rebackfill_pending`)도 끝나야 `ready`다. finra-short는 수집 시점의 유니버스 심볼만 저장하므로, 그 전에는 테이블에 행이
 * 있어도 나중에 매핑된 종목은 비어 있다 — 그 종목의 빈 공매도 구간은 "데이터 부족"이 아니라 "수집 중"이다. 행이 있는 종목은 이 상태와
 * 무관하게 그대로 보인다(`isCollectingAndEmpty`는 비어 있을 때만 참).
 */
export function deriveShortStatus(input: {
    readonly finraEnabled: boolean;
    readonly hasAnyRow: boolean;
    readonly universeComplete: boolean;
    readonly rebackfillPending: boolean;
}): PipelineStatus {
    if (!input.finraEnabled) return 'unknown';
    return input.hasAnyRow && input.universeComplete && !input.rebackfillPending
        ? 'ready'
        : 'collecting';
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
    const readyFrom = addDays(
        today,
        -INVESTOR_FLOWS_SEC_FILINGS_READY_LAG_DAYS
    );
    return compareIsoDate(cursor, readyFrom) >= 0 ? 'ready' : 'collecting';
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
 * 한국 DART 지분공시 준비 상태. 키가 없으면 수집 자체가 돌지 않으므로 `unknown`(해당 없음 — 화면은 "수집 중"이 아니라 "데이터
 * 없음"이고, 키 설정 여부를 드러내지 않는다). 키가 있으면 초기 백필 표식이 있어야 `ready`다.
 */
export function deriveDartStatus(input: {
    readonly dartEnabled: boolean;
    readonly backfillDone: boolean;
}): PipelineStatus {
    if (!input.dartEnabled) return 'unknown';
    return input.backfillDone ? 'ready' : 'collecting';
}

/** 행 목록 하나(`null`·`undefined`는 행 없음으로 본다). */
type SectionRows = readonly unknown[] | null | undefined;

/*
 * 구간의 "수집 중" 판정은 두 종류다 — 마스킹(`maskUncollectedSections`)과 화면·도구 판정(`resolveCollectingArms`)이 같은 규칙을
 * 쓰도록 둘 다 여기 둔다.
 *  - 행 단위 원천(FINRA·FTD·Form 144·증자·과열 목록·DART): 수집 중에 들어온 행은 그 자체로 맞는 행이다 — 비어 있을 때만 수집
 *    중이다(`isCollectingAndEmpty`, 이미 있는 데이터는 가리지 않는다).
 *  - 집계 원천(13F 기관): 분기 합계·상위 보유 기관은 **모든** 제출을 모아야 맞는 값이다. 백필 중의 부분 집계는 보유 기관 수·순매수가
 *    실제보다 작아 "기관 이탈"처럼 읽히므로, 행이 있어도 준비 상태가 `collecting`이면 수집 중이다(`isCollectingAggregate`).
 */

/**
 * 행 단위 구간이 "아직 수집 중이고 비어 있다". 준비 상태가 `collecting`이고 **모든** 행 목록이 비어 있을 때만 참이다(`ready`·
 * `unknown`이면 거짓). `enabled`는 라이선스 플래그다 — 화면·도구 판정은 FINRA·Reg SHO 플래그를 넘기고, 마스킹은 꺼진 피드가 이미
 * `null`이라 `true`를 넘긴다(두 호출부의 차이를 인자로 드러낸다).
 */
export function isCollectingAndEmpty(
    status: PipelineStatus,
    rows: readonly SectionRows[],
    enabled: boolean
): boolean {
    return (
        enabled &&
        status === 'collecting' &&
        rows.every(list => (list?.length ?? 0) === 0)
    );
}

/**
 * 집계 구간(13F)이 "아직 수집 중" — 행이 있어도 부분 집계라 보이지도 채점하지도 않는다. 준비 상태가 `collecting`일 때만 참이다
 * (`ready`·`unknown`이면 거짓 — 상태를 못 읽으면 예전처럼 있는 데이터를 그린다).
 */
export function isCollectingAggregate(status: PipelineStatus): boolean {
    return status === 'collecting';
}

/** 비어 있는 기관(13F) 구간 — core가 "NO DATA(중립 아님)"로 다룬다. */
const EMPTY_INSTITUTIONAL: InvestorFlowsSnapshot['institutional'] = {
    quarters: [],
    topHolders: [],
    topHoldersPeriod: null,
};

/**
 * 아직 수집 중인 구간을 core 계약의 "조회 불가"로 바꾼다 — 빈 배열(`[]`)은 "조회했더니 없음"으로 읽혀 AI·에이전트가
 * "공매도 활동 없음"·"증자 공시 없음"이라고 말할 수 있다. 데이터가 이미 있는 구간은 건드리지 않는다.
 *
 * - 공매도(FINRA)·FTD: `null`(core: 꺼진 피드처럼 빠진다). 과열 목록은 첫 목록을 받기 전이면 이미 `null`이라 할 일이 없다.
 * - Form 144·증자 공시: 필드를 뺀다(core 타입에 `null`이 없다 — 없는 필드는 "이 원천이 없던 옛 스냅샷"으로 보고 채점하지 않는다).
 * - 기관(13F): core 스냅샷이 `null`을 표현하지 못해(비널 `institutional`) 빈 구간으로 바꾼다 — core가 빈 분기 목록을
 *   "NO DATA(중립 아님)"로 렌더·채점한다. 집계 구간이라 행이 있어도 수집 중이면 바꾼다(`isCollectingAggregate`) — 부분 집계가
 *   점수·AI 해석에 "기관 순매도"로 들어가지 않게 한다.
 */
export function maskUncollectedSections(
    snapshot: InvestorFlowsSnapshot,
    readiness: InvestorFlowsPipelineReadiness
): InvestorFlowsSnapshot {
    // 꺼진 피드는 스냅샷이 이미 `null`이고 준비 상태도 `unknown`이라 플래그를 따로 보지 않는다(`enabled: true`).
    const institutionalCollecting = isCollectingAggregate(
        readiness.institutional
    );
    const shortCollecting = isCollectingAndEmpty(
        readiness.short,
        [snapshot.shortInterest, snapshot.shortVolume],
        true
    );
    const ftdCollecting = isCollectingAndEmpty(
        readiness.failsToDeliver,
        [snapshot.failsToDeliver],
        true
    );
    const proposedSalesCollecting = isCollectingAndEmpty(
        readiness.filings,
        [snapshot.proposedSales],
        true
    );
    const offeringsCollecting = isCollectingAndEmpty(
        readiness.filings,
        [snapshot.offerings],
        true
    );
    if (
        !institutionalCollecting &&
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
        ...(institutionalCollecting
            ? { institutional: EMPTY_INSTITUTIONAL }
            : {}),
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
    /** 13F 초기 수집이 아직 안 끝났다 — 구간에 행이 있어도(부분 집계) 참이다(`isCollectingAggregate`). */
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
 * 도구(`dataStatus`)가 같은 판정을 쓰도록 한 곳에 둔다. 행 단위 구간은 **실제로 비어 있을 때만** 참이다: 준비 상태 캐시가
 * 낡았어도 이미 있는 데이터를 "수집 중"이라고 가리지 않는다. 기관(13F)은 집계 구간이라 행이 있어도 수집 중이면 참이다 — 마스킹이
 * 같은 판정으로 점수·AI에서 빼므로, 화면·도구도 그 부분 집계를 결과처럼 보이지 않는다. `ready`·`unknown`이면 항상 거짓이다(예전 동작).
 */
export function resolveCollectingArms(input: {
    readonly readiness: InvestorFlowsPipelineReadiness;
    readonly snapshot: CollectingSnapshotFields;
    readonly finraEnabled: boolean;
    /** Reg SHO 플래그 — 꺼져 있으면 과열 목록은 수집 중이 아니다(공매도의 `finraEnabled`와 같은 역할, 낡은 준비 상태 캐시 방어). */
    readonly regShoEnabled: boolean;
}): CollectingArms {
    const { readiness, snapshot } = input;
    return {
        institutional: isCollectingAggregate(readiness.institutional),
        short: isCollectingAndEmpty(
            readiness.short,
            [snapshot.shortInterest, snapshot.shortVolume],
            input.finraEnabled
        ),
        failsToDeliver: isCollectingAndEmpty(
            readiness.failsToDeliver,
            [snapshot.failsToDeliver],
            true
        ),
        proposedSales: isCollectingAndEmpty(
            readiness.filings,
            [snapshot.proposedSales],
            true
        ),
        offerings: isCollectingAndEmpty(
            readiness.filings,
            [snapshot.offerings],
            true
        ),
        // 과열 목록은 행 목록이 아니라 상태 하나다 — 상태가 없을 때(`null`)만 비어 있다.
        thresholdList:
            isCollectingAndEmpty(
                readiness.thresholdList,
                [],
                input.regShoEnabled
            ) && (snapshot.thresholdList ?? null) === null,
    };
}

/** 스냅샷이 없는 종목(`null`)의 판정 입력 — 모든 구간이 비어 있다. */
export const EMPTY_COLLECTING_SNAPSHOT: CollectingSnapshotFields = {
    institutional: EMPTY_INSTITUTIONAL,
    shortInterest: [],
    shortVolume: [],
    failsToDeliver: [],
    proposedSales: [],
    offerings: [],
    thresholdList: null,
};

/**
 * 한국 종목의 지분공시가 "데이터 없음"이 아니라 "아직 수집 중"인가 — DART 백필이 끝나지 않았고 이 종목의 세 목록(대량보유·소유보고·
 * 거래계획)이 모두 비어 있을 때만 참이다. 미국 갈래(13F·FINRA·SEC)는 보지 않는다(설계 §4.5). 스냅샷이 없으면(`null`) 빈 목록으로
 * 본다. 화면·에이전트 도구·종합 분석이 같은 판정을 쓴다.
 */
export function isKrDisclosureCollecting(
    readiness: InvestorFlowsPipelineReadiness,
    snapshot: InvestorFlowsSnapshot | null
): boolean {
    const kr = snapshot?.kr;
    return isCollectingAndEmpty(
        readiness.dart,
        [kr?.majorHolders, kr?.insiders, kr?.tradingPlans],
        true
    );
}
