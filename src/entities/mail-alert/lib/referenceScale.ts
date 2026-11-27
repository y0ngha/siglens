import {
    alertablePlanLevels,
    type ChangeReference,
} from '@y0ngha/siglens-core';
import { PRICE_ALERT_SCALE_GUARD } from './priceAlertConstants';

/** 저장된 분석이 비교에 내놓는 가격 전부 — 지지선, 저항선, 진입 구간 양 끝, 무효화 기준. */
function referencePrices(reference: ChangeReference): number[] {
    const plan =
        reference.plan === null ? null : alertablePlanLevels(reference.plan);
    return [
        ...reference.supports,
        ...reference.resistances,
        ...(plan?.entryZone == null
            ? []
            : [plan.entryZone.low, plan.entryZone.high]),
        ...(plan?.invalidation == null ? [] : [plan.invalidation]),
    ];
}

/** 분석이 가격대나 계획을 하나라도 가졌는지 — 없으면 가격대·계획 줄을 읽을 근거가 없다. */
export function hasLevels(reference: ChangeReference): boolean {
    return (
        reference.supports.length > 0 ||
        reference.resistances.length > 0 ||
        reference.plan !== null
    );
}

/**
 * 분석의 가격대가 지금 일봉과 같은 가격 척도인지. 봉은 분할이 소급 반영되지만 저장된 분석의 가격은 그렇지 않아
 * (코어 문서의 호출자 몫), 분석 시점에 마감돼 있던 봉(`closedAnchorIndexOf`)의 종가 `anchorClose`에 견준 가격들의
 * 중앙값이 가격대 알림의 척도 가드(`PRICE_ALERT_SCALE_GUARD`) 밖이면 분할이 있었다고 본다. 가격이 짝수 개면 위쪽
 * 가운데 값을 중앙값으로 쓴다(알림 메일이 먼저 쓰던 정의). 시점의 종가가 없거나 가격이 하나도 없으면 견줄 근거가
 * 없어 `false`다. 알림 메일의 "달라진 점"과 다시 연 대화의 카드, 에이전트의 `sinceEarlier`가 같은 판정을 쓴다.
 */
export function referenceScaleHolds(
    reference: ChangeReference,
    anchorClose: number | undefined
): boolean {
    if (anchorClose === undefined || !(anchorClose > 0)) return false;
    const ratios = referencePrices(reference)
        .map(price => price / anchorClose)
        .toSorted((a, b) => a - b);
    const median = ratios[Math.floor(ratios.length / 2)];
    return (
        median !== undefined &&
        median >= PRICE_ALERT_SCALE_GUARD.min &&
        median <= PRICE_ALERT_SCALE_GUARD.max
    );
}

/**
 * 척도가 맞으면 분석을 그대로, 아니면 가격대와 계획을 비운 분석을 돌려준다 — 추세와 신호는 저장된 가격과
 * 무관하므로 남긴다(다시 연 대화의 카드와 `sinceEarlier`).
 */
export function scaleGuardedReference(
    reference: ChangeReference,
    anchorClose: number | undefined
): ChangeReference {
    return referenceScaleHolds(reference, anchorClose)
        ? reference
        : { ...reference, supports: [], resistances: [], plan: null };
}
