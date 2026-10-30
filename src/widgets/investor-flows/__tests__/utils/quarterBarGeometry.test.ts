import { describe, expect, it } from 'vitest';
import {
    barRect,
    BASELINE_Y,
    maxAbsNetChange,
} from '../../utils/quarterBarGeometry';
import type { QuarterBar } from '../../utils/institutional';

function bar(netShareChange: number): QuarterBar {
    return {
        period: '2026-06-30',
        complete: true,
        holders: 1,
        netShareChange,
        direction: netShareChange < 0 ? 'out' : 'in',
    };
}

describe('maxAbsNetChange', () => {
    it('부호와 무관한 가장 큰 절댓값이다', () => {
        expect(maxAbsNetChange([bar(10), bar(-40), bar(5)])).toBe(40);
    });

    it('변화가 모두 0이어도 0으로 나누지 않게 1이다', () => {
        expect(maxAbsNetChange([bar(0)])).toBe(1);
    });
});

describe('barRect', () => {
    it('순변화 0은 높이 0이라 그리지 않는다', () => {
        expect(barRect(0, 'flat', 10).height).toBe(0);
    });

    it('IN은 기준선 위로, OUT은 기준선 아래로 뻗는다', () => {
        const up = barRect(10, 'in', 10);
        const down = barRect(-10, 'out', 10);
        expect(up.y + up.height).toBe(BASELINE_Y);
        expect(down.y).toBe(BASELINE_Y);
        expect(up.height).toBe(down.height);
    });

    it('가장 긴 막대는 영역 가장자리에 4px 여백을 남긴다', () => {
        expect(barRect(10, 'in', 10).height).toBe(BASELINE_Y - 4);
    });

    it('아주 작은 변화도 최소 3px로 보인다', () => {
        expect(barRect(1, 'in', 1_000_000).height).toBe(3);
    });
});
