/**
 * 수집 중·일시 조회 불가 판정 — 준비 상태와 스냅샷에서 "데이터 없음"과 구분해 말할 구간·축을 고른다.
 */
import type { InvestorFlowsAxisId } from '@y0ngha/siglens-core';
import { resolveCollectingArms } from '@/entities/investor-flows/lib/investorFlowsReadiness';
import type { InvestorFlowsDegradedPart } from '@/entities/investor-flows/model';

/** 미국 수급 탭의 구간별 수집 중 판정 입력 — 엔티티 `resolveCollectingArms`와 같은 모양이다. */
export type ResolveCollectingInput = Parameters<
    typeof resolveCollectingArms
>[0];

/** 구간별 "수집 중" 판정 결과 — 위젯 UI가 엔티티 lib를 직접 import하지 않고 쓰는 이름이다. */
export type CollectingArms = ReturnType<typeof resolveCollectingArms>;

/**
 * 구간별 "수집 중" 판정. 위젯 `.tsx`가 엔티티 lib를 직접 부르지 않도록 이 util이 판정을 맡는다 — 초기 수집이 끝나기 전의 빈
 * 구간은 종목에 데이터가 없다는 뜻이 아니다.
 */
export function resolveFlowsCollecting(
    input: ResolveCollectingInput
): CollectingArms {
    return resolveCollectingArms(input);
}

/** 점수 카드에서 "데이터 부족" 대신 "수집 중"으로 표시할 축. */
export function collectingAxes(state: CollectingArms): InvestorFlowsAxisId[] {
    return [
        ...(state.institutional ? (['institutional'] as const) : []),
        ...(state.short ? (['short'] as const) : []),
        ...(state.offerings ? (['dilution'] as const) : []),
    ];
}

/** 일시 degrade된 부분 → 그 때문에 "데이터 부족"이 될 수 있는 축. 13D/G는 대량보유 축, 유통주식수는 공매도 축(유통주식 대비 비율). */
const DEGRADED_PART_AXIS: Record<
    InvestorFlowsDegradedPart,
    InvestorFlowsAxisId
> = {
    largeHolders: 'largeHolders',
    float: 'short',
};

/**
 * 점수 카드에서 "데이터 부족" 대신 "일시적으로 불러오지 못했어요"로 표시할 축(`snapshot.degraded`).
 *
 * 유통주식수(`float`)가 빠져도 공매도 축이 모자란 이유가 그것일 때만 공매도 축을 일시 조회 불가로 본다 — 그 종목의 FINRA 공매도
 * 행이 있어야(`hasShortData`) 유통주식수가 유일한 빈칸이다. FINRA가 꺼졌거나 행이 없으면 FMP가 돌아와도 여전히 모자라므로
 * "일시적"이라고 말하지 않는다.
 */
export function temporarilyUnavailableAxes(
    degraded: readonly InvestorFlowsDegradedPart[] | undefined,
    hasShortData: boolean
): InvestorFlowsAxisId[] {
    return [
        ...new Set(
            (degraded ?? [])
                .filter(part => part !== 'float' || hasShortData)
                .map(part => DEGRADED_PART_AXIS[part])
        ),
    ];
}
