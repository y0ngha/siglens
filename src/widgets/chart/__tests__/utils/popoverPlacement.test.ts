import {
    computePopoverPlacement,
    POPOVER_MAX_HEIGHT,
    POPOVER_TRIGGER_GAP,
    POPOVER_VIEWPORT_MARGIN,
} from '../../utils/popoverPlacement';

const M = POPOVER_VIEWPORT_MARGIN;

/** 헤더 띠 오른쪽 끝에 있는 톱니바퀴(폭 28) — 뷰포트 오른쪽 끝에서 안쪽 12px. */
const gearAt = (viewportWidth: number, bottom = 300) => ({
    right: viewportWidth - 12,
    bottom,
});

describe('computePopoverPlacement', () => {
    it('트리거 바로 아래(간격 4px)에서 시작하고 오른쪽 끝을 트리거에 맞춘다', () => {
        const p = computePopoverPlacement({
            trigger: { right: 1000, bottom: 200 },
            viewport: { width: 1280, height: 900 },
            width: 352,
        });
        expect(p.top).toBe(200 + POPOVER_TRIGGER_GAP);
        expect(p.left + p.width).toBe(1000);
        expect(p.width).toBe(352);
    });

    it.each([320, 375, 768, 1280])(
        '%ipx 뷰포트에서도 패널이 좌우 여백 안에 머문다(폭 352)',
        viewportWidth => {
            const p = computePopoverPlacement({
                trigger: gearAt(viewportWidth),
                viewport: { width: viewportWidth, height: 667 },
                width: 352,
            });
            expect(p.left).toBeGreaterThanOrEqual(M);
            expect(p.left + p.width).toBeLessThanOrEqual(viewportWidth - M);
        }
    );

    it('좁은 뷰포트에서는 폭을 줄인다(320 → 304)', () => {
        const p = computePopoverPlacement({
            trigger: gearAt(320),
            viewport: { width: 320, height: 667 },
            width: 352,
        });
        expect(p.width).toBe(320 - M * 2);
        expect(p.left).toBe(M);
    });

    it('트리거가 왼쪽에 치우쳐 있어도 왼쪽 여백 밖으로 나가지 않는다(124px 차트 열의 트리거)', () => {
        const p = computePopoverPlacement({
            trigger: { right: 130, bottom: 120 },
            viewport: { width: 768, height: 900 },
            width: 352,
        });
        expect(p.left).toBe(M);
    });

    it('높이는 뷰포트 아래 끝까지로 제한하고 상한은 448이다', () => {
        const short = computePopoverPlacement({
            trigger: gearAt(375, 300),
            viewport: { width: 375, height: 667 },
            width: 240,
        });
        expect(short.maxHeight).toBe(667 - (300 + POPOVER_TRIGGER_GAP) - M);
        const tall = computePopoverPlacement({
            trigger: gearAt(1280, 200),
            viewport: { width: 1280, height: 1400 },
            width: 240,
        });
        expect(tall.maxHeight).toBe(POPOVER_MAX_HEIGHT);
    });

    it('트리거가 뷰포트 아래에 있어도 maxHeight는 음수가 되지 않는다', () => {
        const p = computePopoverPlacement({
            trigger: { right: 300, bottom: 900 },
            viewport: { width: 375, height: 667 },
            width: 240,
        });
        expect(p.maxHeight).toBe(0);
    });

    it('넓은 화면에서도 오른쪽 끝을 트리거에 맞춰 버튼 바로 아래로 연다', () => {
        const p = computePopoverPlacement({
            trigger: { right: 1000, bottom: 200 },
            viewport: { width: 1280, height: 900 },
            width: 240,
        });
        expect(p.left + p.width).toBe(1000);
        expect(p.top).toBe(204);
    });
});
