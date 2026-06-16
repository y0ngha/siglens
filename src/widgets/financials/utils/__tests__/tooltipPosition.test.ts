// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { placeTooltip } from '../tooltipPosition';

// jsdom 기본 뷰포트(1024×768)를 케이스별로 덮어쓴 뒤 복원한다.
const ORIGINAL_WIDTH = window.innerWidth;
const ORIGINAL_HEIGHT = window.innerHeight;

function setViewport(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', {
        value: width,
        writable: true,
        configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
        value: height,
        writable: true,
        configurable: true,
    });
}

describe('placeTooltip', () => {
    afterEach(() => {
        setViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT);
    });

    it('뷰포트 안쪽이면 커서 오른쪽·아래에 오프셋으로 배치한다', () => {
        setViewport(1024, 768);
        const { left, top } = placeTooltip(100, 100);
        // 오버플로우 없음 → clientX/Y + GAP(12)
        expect(left).toBe(112);
        expect(top).toBe(112);
    });

    it('커서가 우측 가장자리에 가까우면 툴팁을 왼쪽으로 flip한다', () => {
        setViewport(200, 768);
        const { left } = placeTooltip(195, 100);
        // overflowRight=true → clientX - EST_WIDTH(200) - GAP(12) = -17 → Math.max(12)
        expect(left).toBeLessThan(195);
        expect(left).toBe(12);
    });

    it('커서가 하단 가장자리에 가까우면 툴팁을 위로 flip한다', () => {
        setViewport(1024, 150);
        const { top } = placeTooltip(100, 145);
        // overflowBottom=true → clientY - EST_HEIGHT(140) - GAP(12) = -7 → Math.max(12)
        expect(top).toBeLessThan(145);
        expect(top).toBe(12);
    });

    it('우측·하단 모두 넘치면 양쪽 다 flip하고 최소 GAP로 클램프한다', () => {
        setViewport(300, 250);
        const { left, top } = placeTooltip(290, 240);
        // left = 290 - 212 = 78, top = 240 - 152 = 88 (둘 다 양수라 클램프 불필요)
        expect(left).toBe(78);
        expect(top).toBe(88);
    });
});
