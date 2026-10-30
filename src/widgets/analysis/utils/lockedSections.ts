/**
 * 잠긴 정보 깊이(`lockedInfoDepth`) → 패널에서 숨길 섹션 플래그 판정.
 */
import type { TierInfoDepth } from '@y0ngha/siglens-core';

/** 매매 전략 섹션(진입·손절·목표)을 잠그는 TierInfoDepth 값들. */
const LOCKED_ACTION_INFO_DEPTHS: readonly TierInfoDepth[] = [
    'entry',
    'stoploss',
    'target',
    'full_detail',
];

export interface LockedSections {
    /** 잠긴 조각이 하나라도 있다 — 업셀 카드·복사 버튼 숨김의 기준. */
    hasLockedDetails: boolean;
    /** 리스크 배지 숨김. (주요 레벨은 core가 같은 깊이에서 이미 비워 보낸다.) */
    hasLockedPartialDetail: boolean;
    /** 매매 전략 섹션·미터 공개 띠 숨김. */
    hasLockedActionDetail: boolean;
    /**
     * confidence 배지 숨김 — 잠긴 티어는 confidenceWeight가 0으로 마스킹되어 와
     * 그대로 그리면 'medium'으로 오표시된다.
     */
    hasLockedConfidence: boolean;
}

/** `lockedInfoDepth` 배열을 섹션별 잠금 플래그로 펼친다. */
export function resolveLockedSections(
    lockedInfoDepth: readonly TierInfoDepth[]
): LockedSections {
    const hasLockedDetails = lockedInfoDepth.length > 0;
    return {
        hasLockedDetails,
        hasLockedPartialDetail:
            hasLockedDetails && lockedInfoDepth.includes('partial_detail'),
        hasLockedActionDetail:
            hasLockedDetails &&
            lockedInfoDepth.some(depth =>
                LOCKED_ACTION_INFO_DEPTHS.includes(depth)
            ),
        hasLockedConfidence:
            hasLockedDetails && lockedInfoDepth.includes('confidence'),
    };
}
