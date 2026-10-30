import { FEAR_GREED_LABEL_CUTOFFS } from '@y0ngha/siglens-core';
import {
    NEEDLE_POINTS,
    TICK_VALUES,
    describeSegmentArc,
    needleRotationDeg,
    tickLabelPosition,
    tickTextAnchor,
} from '@/shared/ui/utils/fearGreedGaugeGeometry';

/** 호 path(`M x1 y1 A rx ry rotation large-arc sweep x2 y2`)의 숫자 9개를 뽑는다 — 개수가 다르면 그 자리에서 실패한다. */
function arcNumbers(path: string): number[] {
    const numbers = Array.from(
        path.matchAll(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi),
        match => Number(match[0])
    );
    expect(numbers).toHaveLength(9);
    return numbers;
}

describe('needleRotationDeg', () => {
    it.each([
        [100, 0],
        [50, -90],
        [0, -180],
    ])('score %i -> %i도', (score, expected) => {
        expect(needleRotationDeg(score)).toBeCloseTo(expected, 10);
    });
});

describe('NEEDLE_POINTS', () => {
    it('각도 0에서 오른쪽을 향한 삼각형이다', () => {
        expect(NEEDLE_POINTS).toBe('184,105 112,99 112,111');
    });
});

describe('describeSegmentArc', () => {
    it('50점에서 100점까지의 호는 위쪽 중앙에서 오른쪽 끝으로 간다', () => {
        // path 문자열 포맷(공백·구분자)에 묶이지 않도록 숫자만 뽑아 비교한다.
        // M x1 y1 A rx ry rotation large-arc sweep x2 y2
        const [x1, y1, , , , , , x2, y2] = arcNumbers(
            describeSegmentArc(50, 100)
        );
        expect(x1).toBeCloseTo(100, 8);
        expect(y1).toBeCloseTo(25, 8);
        expect(x2).toBeCloseTo(180, 8);
        expect(y2).toBeCloseTo(105, 8);
    });

    it('반지름 80으로 시계 방향(sweep=1) 호를 그린다', () => {
        const [, , rx, ry, rotation, largeArc, sweep] = arcNumbers(
            describeSegmentArc(0, 50)
        );
        expect([rx, ry, rotation, largeArc, sweep]).toEqual([80, 80, 0, 0, 1]);
    });
});

describe('tickLabelPosition', () => {
    it('50점 눈금은 호 위쪽 중앙(반경 96)에 놓인다', () => {
        const { x, y } = tickLabelPosition(50);
        expect(x).toBeCloseTo(100, 8);
        expect(y).toBeCloseTo(9, 8);
    });

    it('0점과 100점 눈금은 호 끝 높이보다 14 아래로 내린다', () => {
        expect(tickLabelPosition(0).y).toBeCloseTo(119, 8);
        expect(tickLabelPosition(100).y).toBeCloseTo(119, 8);
    });
});

describe('tickTextAnchor', () => {
    it.each([
        [0, 'start'],
        [100, 'end'],
        [50, 'middle'],
    ])('%i -> %s', (value, expected) => {
        expect(tickTextAnchor(value)).toBe(expected);
    });
});

describe('TICK_VALUES', () => {
    it('양 끝과 중앙 눈금을 포함한다', () => {
        expect(TICK_VALUES).toContain(0);
        expect(TICK_VALUES).toContain(50);
        expect(TICK_VALUES).toContain(100);
    });

    it('core의 극단 공포·탐욕 경계를 눈금으로 포함한다', () => {
        expect(TICK_VALUES).toContain(
            FEAR_GREED_LABEL_CUTOFFS.EXTREME_FEAR_MAX
        );
        expect(TICK_VALUES).toContain(FEAR_GREED_LABEL_CUTOFFS.GREED_MAX);
    });
});
