import {
    SNAP_PEEK,
    SNAP_HALF,
    SNAP_FULL,
    MOBILE_SNAP_POINTS,
    SNAP_POINTS_MUTABLE,
    PEEK_VISIBLE_OFFSET,
    VAUL_EASING,
    DRAG_RESISTANCE,
    DRAG_THRESHOLD_PX,
    DRAG_TO_PEEK_THRESHOLD,
    DRAG_TO_HALF_THRESHOLD,
    SNAP_BACK_DURATION,
} from '@/views/symbol/constants/mobileSheet';

describe('mobileSheet constants', () => {
    // 이 값은 취향이 아니라 실측에서 나온 계약이다. 시트는 h-[97svh] 고정이고
    // vaul은 오프셋을 (1 − snap)·innerHeight로 잡으므로 실제로 보이는 띠는
    // `snap − PEEK_VISIBLE_OFFSET`이다. 차트를 가리지 않는 실측 임계값은 3개 기기에서
    // 0.194(Pixel 7) / 0.206(iPhone 14) / 0.215(iPhone SE)였다.
    // 0.20 → 띠 0.17로 가장 빡빡한 0.194 아래에 머문다. 값을 올리려면 먼저
    // 다시 측정할 것 — 상수를 참조하는 단언만으로는 이 계약이 깨져도 초록불이다.
    it('SNAP_PEEK가 만드는 가시 띠(snap − PEEK_VISIBLE_OFFSET)는 차트 커버리지 임계값 아래다', () => {
        expect(SNAP_PEEK).toBe(0.2);

        const visibleStrip = SNAP_PEEK - PEEK_VISIBLE_OFFSET;
        const TIGHTEST_COVERAGE_THRESHOLD = 0.194;
        expect(visibleStrip).toBeLessThan(TIGHTEST_COVERAGE_THRESHOLD);
    });

    it('snap points are ordered from smallest to largest', () => {
        expect(SNAP_PEEK).toBeLessThan(SNAP_HALF);
        expect(SNAP_HALF).toBeLessThan(SNAP_FULL);
    });

    it('snap points are between 0 and 1 (viewport fractions)', () => {
        for (const snap of [SNAP_PEEK, SNAP_HALF, SNAP_FULL]) {
            expect(snap).toBeGreaterThan(0);
            expect(snap).toBeLessThanOrEqual(1);
        }
    });

    it('MOBILE_SNAP_POINTS contains all three snap points in order', () => {
        expect(MOBILE_SNAP_POINTS).toEqual([SNAP_PEEK, SNAP_HALF, SNAP_FULL]);
    });

    it('SNAP_POINTS_MUTABLE is a mutable copy of MOBILE_SNAP_POINTS', () => {
        expect(SNAP_POINTS_MUTABLE).toEqual([...MOBILE_SNAP_POINTS]);
        const copy = [...SNAP_POINTS_MUTABLE];
        copy.push(0.99);
        expect(copy).toHaveLength(MOBILE_SNAP_POINTS.length + 1);
        expect(SNAP_POINTS_MUTABLE).toHaveLength(MOBILE_SNAP_POINTS.length);
    });

    it('VAUL_EASING is a valid CSS cubic-bezier string', () => {
        expect(VAUL_EASING).toMatch(/^cubic-bezier\(.+\)$/);
    });

    it('DRAG_RESISTANCE is between 0 and 1', () => {
        expect(DRAG_RESISTANCE).toBeGreaterThan(0);
        expect(DRAG_RESISTANCE).toBeLessThanOrEqual(1);
    });

    it('DRAG_THRESHOLD_PX is a positive integer', () => {
        expect(DRAG_THRESHOLD_PX).toBeGreaterThan(0);
        expect(Number.isInteger(DRAG_THRESHOLD_PX)).toBe(true);
    });

    it('DRAG_TO_PEEK_THRESHOLD is greater than DRAG_TO_HALF_THRESHOLD', () => {
        expect(DRAG_TO_PEEK_THRESHOLD).toBeGreaterThan(DRAG_TO_HALF_THRESHOLD);
    });

    it('SNAP_BACK_DURATION is a valid CSS time string', () => {
        expect(SNAP_BACK_DURATION).toMatch(/^\d+(\.\d+)?(s|ms)$/);
    });
});
