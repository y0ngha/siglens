import type { InvestorFlowsSnapshot } from '@y0ngha/siglens-core';
import type { InvestorFlowsPipelineReadiness, PipelineStatus } from '../model';

/** 상태를 읽지 못했을 때(또는 해당 없음) — 화면은 "수집 중"을 주장하지 않고 예전 동작으로 돌아간다. */
export const UNKNOWN_PIPELINE_READINESS: InvestorFlowsPipelineReadiness = {
    institutional: 'unknown',
    short: 'unknown',
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

/**
 * 공매도가 아직 수집 중이면 스냅샷의 공매도 필드를 `null`("조회 불가", core 계약)로 바꾼다. 빈 배열(`[]`)은 "조회했더니
 * 없음"으로 읽혀 AI·에이전트가 "공매도 활동 없음"이라고 말할 수 있다. 데이터가 이미 있으면 건드리지 않는다.
 * 기관(13F)은 core 스냅샷이 `null`을 표현하지 못해(비널 `institutional`) 이 방식으로 가릴 수 없다 — core가 빈 분기 목록을
 * "NO DATA(중립 아님)"로 렌더하는 것에 맡긴다.
 */
export function maskUncollectedShort(
    snapshot: InvestorFlowsSnapshot,
    readiness: InvestorFlowsPipelineReadiness
): InvestorFlowsSnapshot {
    if (readiness.short !== 'collecting') return snapshot;
    const hasRows =
        (snapshot.shortInterest?.length ?? 0) > 0 ||
        (snapshot.shortVolume?.length ?? 0) > 0;
    if (hasRows) return snapshot;
    return { ...snapshot, shortInterest: null, shortVolume: null };
}

export interface CollectingArms {
    /** 13F 구간이 비어 있고 초기 수집이 아직 안 끝났다. */
    readonly institutional: boolean;
    /** FINRA가 켜져 있고 공매도 구간이 비어 있으며 첫 수집이 아직 안 끝났다. */
    readonly short: boolean;
}

/**
 * 이 종목의 어느 구간이 "데이터 없음"이 아니라 "아직 수집 중"으로 말해야 하는지 — 화면(`InvestorFlowsContent`)과 에이전트
 * 도구(`dataStatus`)가 같은 판정을 쓰도록 한 곳에 둔다. **구간이 실제로 비어 있을 때만** 참이다: 준비 상태 캐시가 낡았어도
 * 이미 있는 데이터를 "수집 중"이라고 가리지 않고, `ready`·`unknown`이면 항상 거짓이다(예전 동작).
 */
export function resolveCollectingArms(input: {
    readonly readiness: InvestorFlowsPipelineReadiness;
    readonly institutional: InvestorFlowsSnapshot['institutional'];
    readonly shortInterest: InvestorFlowsSnapshot['shortInterest'];
    readonly shortVolume: InvestorFlowsSnapshot['shortVolume'];
    readonly finraEnabled: boolean;
}): CollectingArms {
    const hasInstitutional =
        input.institutional.quarters.length > 0 ||
        input.institutional.topHolders.length > 0;
    const hasShort =
        (input.shortInterest?.length ?? 0) > 0 ||
        (input.shortVolume?.length ?? 0) > 0;
    return {
        institutional:
            input.readiness.institutional === 'collecting' && !hasInstitutional,
        short:
            input.finraEnabled &&
            input.readiness.short === 'collecting' &&
            !hasShort,
    };
}
