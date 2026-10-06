/**
 * 레벨 라벨 우선순위 — 겹칠 때 큰 쪽이 남는다(`visibleLevelLabels`).
 * 강조한 작도 > 돌파선 > 그 밖의 레벨. 제목이 없는 선분은 겨룰 일이 없어 최하.
 */
export const LABEL_PRIORITY = {
    untitled: 0,
    level: 1,
    breakout: 2,
    highlighted: 3,
} as const;

/** 가격축 옆 레벨 라벨 하나 — 화면 y좌표와 우선순위. */
export interface LevelLabelSlot {
    /** 라벨 중심의 y(px). 좌표를 아직 못 구했으면(`null`) 숨기지 않는다. */
    y: number | null;
    /** 클수록 먼저 자리를 잡는다. */
    priority: number;
}

/**
 * 서로 겹치는 레벨 라벨 중 우선순위가 낮은 쪽을 숨긴다. 반환값은 **보일** 라벨의 인덱스.
 *
 * 예전에는 결과선(무효화·목표)을 내는 작도가 3개 이상이면 개수만 보고 강조한 작도의
 * 라벨만 남겼다. 그러자 주변에 아무것도 없는 목표선도 라벨 없이 선만 남아, 선을 hover해야
 * 무엇인지 보였다(2026-10-06 사용자 제보). 실제로 겹치는지는 지금 화면의 좌표로만 알 수
 * 있으니 좌표로 판정한다.
 *
 * 우선순위가 같으면 입력 순서가 앞선 것이 이긴다 — 스크롤마다 같은 자리의 라벨이
 * 번갈아 깜박이지 않도록 결정적이어야 한다.
 */
export function visibleLevelLabels(
    slots: readonly LevelLabelSlot[],
    minGapPx: number
): Set<number> {
    const order = slots
        .map((slot, index) => ({ ...slot, index }))
        .toSorted((a, b) => b.priority - a.priority || a.index - b.index);
    const placed: number[] = [];
    const visible = new Set<number>();
    for (const { y, index } of order) {
        if (y === null) {
            visible.add(index);
            continue;
        }
        if (placed.some(p => Math.abs(p - y) < minGapPx)) continue;
        placed.push(y);
        visible.add(index);
    }
    return visible;
}
