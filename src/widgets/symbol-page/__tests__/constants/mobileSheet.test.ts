import {
    SNAP_PEEK,
    SNAP_HALF,
    SNAP_FULL,
    MOBILE_SNAP_POINTS,
    SNAP_POINTS_MUTABLE,
    VAUL_EASING,
    DRAG_RESISTANCE,
    DRAG_THRESHOLD_PX,
    DRAG_TO_PEEK_THRESHOLD,
    DRAG_TO_HALF_THRESHOLD,
    SNAP_BACK_DURATION,
} from '@/widgets/symbol-page/constants/mobileSheet';

describe('mobileSheet constants', () => {
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
        SNAP_POINTS_MUTABLE.push(0.99);
        expect(SNAP_POINTS_MUTABLE).toHaveLength(4);
        SNAP_POINTS_MUTABLE.pop();
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
