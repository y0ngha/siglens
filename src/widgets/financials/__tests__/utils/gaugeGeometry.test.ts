import { describe, expect, it } from 'vitest';
import {
    GAUGE_CENTER,
    SCORE_MAX,
    SCORE_MIN,
    SEGMENTS,
    TICK_VALUES,
    needlePoints,
    needleRotationDeg,
    segmentArcPath,
    tickLabelPlacement,
} from '@/widgets/financials/utils/gaugeGeometry';

describe('SEGMENTS', () => {
    it('0에서 100까지 빈틈 없이 이어진다', () => {
        expect(SEGMENTS[0].from).toBe(SCORE_MIN);
        expect(SEGMENTS.at(-1)?.to).toBe(SCORE_MAX);
        SEGMENTS.slice(1).forEach((segment, i) => {
            expect(segment.from).toBe(SEGMENTS[i].to);
        });
    });
});

describe('segmentArcPath', () => {
    it('반원 위의 호 경로를 만든다', () => {
        const numbers = segmentArcPath({ from: 0, to: 100, strokeClass: '' })
            .match(/-?\d+(\.\d+)?(e-?\d+)?/g)!
            .map(Number);
        const [startX, startY, , , , , , endX, endY] = numbers;
        const center = GAUGE_CENTER;
        // 0점은 반원의 왼쪽 끝, 100점은 오른쪽 끝이고 둘 다 중심과 같은 높이다.
        expect(startX).toBeLessThan(center.x);
        expect(endX).toBeGreaterThan(center.x);
        expect(startY).toBeCloseTo(center.y);
        expect(endY).toBeCloseTo(center.y);
        expect(center.x - startX).toBeCloseTo(endX - center.x);
    });
});

describe('tickLabelPlacement', () => {
    it('양 끝 눈금은 안쪽 정렬이고 아래로 내린다', () => {
        const left = tickLabelPlacement(SCORE_MIN);
        const right = tickLabelPlacement(SCORE_MAX);
        expect(left.anchor).toBe('start');
        expect(right.anchor).toBe('end');
        expect(left.y).toBeGreaterThan(GAUGE_CENTER.y);
    });

    it('나머지 눈금은 가운데 정렬이다', () => {
        TICK_VALUES.filter(v => v !== SCORE_MIN && v !== SCORE_MAX).forEach(
            v => {
                expect(tickLabelPlacement(v).anchor).toBe('middle');
            }
        );
    });
});

describe('needleRotationDeg', () => {
    it('100점은 회전 없음, 0점은 반원 끝까지 반시계 180°, 중간은 그 절반이다', () => {
        expect(Math.abs(needleRotationDeg(SCORE_MAX))).toBeCloseTo(0);
        expect(needleRotationDeg(SCORE_MIN)).toBeCloseTo(-180);
        expect(needleRotationDeg((SCORE_MIN + SCORE_MAX) / 2)).toBeCloseTo(-90);
    });

    it('범위를 벗어난 점수는 자르고, 점수가 없으면 0점 위치다', () => {
        expect(needleRotationDeg(SCORE_MAX + 50)).toBeCloseTo(
            needleRotationDeg(SCORE_MAX)
        );
        expect(needleRotationDeg(SCORE_MIN - 20)).toBeCloseTo(
            needleRotationDeg(SCORE_MIN)
        );
        expect(needleRotationDeg(null)).toBeCloseTo(
            needleRotationDeg(SCORE_MIN)
        );
    });
});

describe('needlePoints', () => {
    it('끝이 오른쪽(100점 방향)을 향하고 밑변은 중심 가까이에서 수직이다', () => {
        const [tip, top, bottom] = needlePoints()
            .split(' ')
            .map(point => point.split(',').map(Number));
        expect(tip[1]).toBeCloseTo(GAUGE_CENTER.y);
        expect(tip[0]).toBeGreaterThan(GAUGE_CENTER.x);
        expect(top[0]).toBeCloseTo(bottom[0]);
        expect(top[0]).toBeGreaterThan(GAUGE_CENTER.x);
        expect(top[0]).toBeLessThan(tip[0]);
        expect(top[1]).toBeLessThan(GAUGE_CENTER.y);
        expect(bottom[1]).toBeGreaterThan(GAUGE_CENTER.y);
    });
});
