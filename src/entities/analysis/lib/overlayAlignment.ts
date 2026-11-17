import type { ChartOverlay } from '@y0ngha/siglens-core';

/**
 * 작도와 봉의 시각 정렬 — 차트(`widgets/chart`)와 SIGLENS AI의 차트 블록(서버, `chartBlock.ts`)이 같은 정의를 쓰도록
 * 한 곳에 둔다. 한쪽만 바뀌면 서버가 저장한 작도가 차트에서 그려지지 않거나 그 반대가 된다.
 */

/** 작도가 기대는 봉 시각 전부 — 선분 양 끝, 레벨 시작, 라벨 위치. */
export function overlayTimes(overlay: ChartOverlay): number[] {
    return [
        ...overlay.segments.flatMap(s => [s.from.time, s.to.time]),
        ...overlay.levels.map(l => l.fromTime),
        ...overlay.labels.map(l => l.at.time),
    ];
}

/** 로드된 봉의 시각 집합 — 작도가 봉에 맞는지(`isOverlayAlignedToBars`) 판정하는 기준. */
export function barTimesOf(bars: readonly { time: number }[]): Set<number> {
    return new Set(bars.map(b => b.time));
}

/**
 * 작도의 모든 기준 시각이 지금 로드된 봉에 있는지. 다른 timeframe의 분석이 잠깐 남아 있거나 봉 창이 좁아졌을 때
 * 엉뚱한 위치에 그리지 않게 한다.
 */
export function isOverlayAlignedToBars(
    overlay: ChartOverlay,
    barTimes: ReadonlySet<number>
): boolean {
    return overlayTimes(overlay).every(t => barTimes.has(t));
}
