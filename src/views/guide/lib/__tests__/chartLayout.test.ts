import { describe, expect, it } from 'vitest';
import {
    estimateLabelWidth,
    formatCompact,
    formatTick,
    linearScale,
    niceStep,
    niceTicks,
    placeLabel,
    splitRuns,
    type LabelBox,
} from '@/views/guide/lib/chartLayout';

describe('linearScale', () => {
    it('정의역을 치역에 대응시키고 폭이 0인 정의역은 가운데로 보낸다', () => {
        const scale = linearScale(0, 10, 100, 0);
        expect(scale(0)).toBe(100);
        expect(scale(10)).toBe(0);
        expect(scale(5)).toBe(50);
        expect(linearScale(3, 3, 0, 10)(3)).toBe(5);
    });
});

describe('niceTicks', () => {
    it('범위 안에서 1/2/5 단위 간격을 고른다', () => {
        const ticks = niceTicks(92, 131, 5);
        expect(ticks).toEqual([100, 110, 120, 130]);
        expect(formatTick(100, 10)).toBe('100');
    });

    it('작은 간격에는 소수를 쓴다', () => {
        const ticks = niceTicks(0, 1, 4);
        expect(ticks[0]).toBe(0);
        expect(ticks).toEqual([0, 0.5, 1]);
        expect(formatTick(0.5, ticks[1] - ticks[0])).toBe('0.5');
        expect(formatTick(0.25, 0.05)).toBe('0.25');
    });
});

describe('placeLabel', () => {
    const bounds = { top: 0, bottom: 200 };

    it('겹치는 라벨을 빈자리가 나올 때까지 밀어낸다', () => {
        const first = placeLabel(
            [],
            { x: 10, y: 50, width: 40, height: 14 },
            -1,
            bounds
        );
        const second = placeLabel(
            [first],
            { x: 20, y: 50, width: 40, height: 14 },
            -1,
            bounds
        );
        expect(first.y).toBe(50);
        expect(second.y).toBeLessThan(50 - 14 + 1);
    });

    it('결과를 placed 목록에 더하지 않는다', () => {
        const placed: readonly LabelBox[] = [
            { x: 100, y: 100, width: 10, height: 14 },
        ];
        placeLabel(placed, { x: 0, y: 20, width: 10, height: 14 }, -1, bounds);
        expect(placed).toEqual([{ x: 100, y: 100, width: 10, height: 14 }]);
    });

    it('라벨을 세로 경계 안에 둔다', () => {
        const box = placeLabel(
            [],
            { x: 0, y: -30, width: 10, height: 14 },
            -1,
            bounds
        );
        expect(box.y).toBe(0);
    });
});

describe('splitRuns', () => {
    it('null에서 선을 끊는다', () => {
        const runs = splitRuns(
            [1, 2, null, 4],
            i => i,
            v => v
        );
        expect(runs).toHaveLength(2);
        expect(runs[0]).toHaveLength(2);
        expect(runs[1]).toEqual([{ x: 3, y: 4 }]);
    });
});

describe('estimateLabelWidth', () => {
    it('넓은 글자는 더 넓게 센다', () => {
        expect(estimateLabelWidth('가가', 12)).toBeGreaterThan(
            estimateLabelWidth('ab', 12)
        );
    });
});

describe('formatCompact', () => {
    it('큰 수를 줄여 쓴다', () => {
        expect(formatCompact(-200_000_000)).toBe('-200M');
        expect(formatCompact(1_500_000_000)).toBe('1.5B');
        expect(formatCompact(250_000)).toBe('250K');
        expect(formatCompact(512)).toBe('512');
    });
});

describe('placeLabel 반대 방향 대체', () => {
    it('선호 방향이 경계에 막히면 반대 방향을 시도한다', () => {
        const bounds = { top: 0, bottom: 100 };
        const a = placeLabel(
            [],
            { x: 0, y: 0, width: 30, height: 14 },
            -1,
            bounds
        );
        const b = placeLabel(
            [a],
            { x: 0, y: 0, width: 30, height: 14 },
            -1,
            bounds
        );
        expect(a.y).toBe(0);
        expect(b.y).toBeGreaterThanOrEqual(15);
    });
});

describe('placeLabel 장애물', () => {
    const bounds = { top: 0, bottom: 200, left: 0, right: 300 };

    it('아래 봉에서 가장 가까운 빈 쪽으로 라벨을 옮긴다', () => {
        const candle: LabelBox = { x: 40, y: 40, width: 8, height: 60 };
        const result = placeLabel(
            [],
            { x: 20, y: 60, width: 40, height: 14 },
            -1,
            bounds,
            [candle]
        );
        const clear =
            result.x + result.width <= candle.x ||
            result.x >= candle.x + candle.width ||
            result.y + result.height <= candle.y ||
            result.y >= candle.y + candle.height;
        expect(clear).toBe(true);
    });

    it('라벨을 가로 경계 안에 둔다', () => {
        const result = placeLabel(
            [],
            { x: 0, y: 60, width: 40, height: 14 },
            -1,
            bounds,
            [{ x: 0, y: 50, width: 60, height: 40 }]
        );
        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.x + result.width).toBeLessThanOrEqual(300);
    });
});

describe('niceStep', () => {
    it('원시 간격을 1, 2, 5 × 10^n으로 올린다', () => {
        expect(niceStep(0.3)).toBe(0.5);
        expect(niceStep(1.4)).toBe(2);
        expect(niceStep(700_000)).toBe(1_000_000);
    });
});
