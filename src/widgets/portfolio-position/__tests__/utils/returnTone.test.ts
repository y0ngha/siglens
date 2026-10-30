import { describe, expect, it } from 'vitest';
import {
    currentMarkerClass,
    returnSign,
    returnTextClass,
} from '@/widgets/portfolio-position/utils/returnTone';

describe('returnTone', () => {
    describe('returnSign', () => {
        it.each([
            [0.01, 'gain'],
            [-0.01, 'loss'],
            [0, 'flat'],
        ] as const)('%s → %s', (value, sign) => {
            expect(returnSign(value)).toBe(sign);
        });
    });

    describe('returnTextClass', () => {
        it('이익은 success, 손실은 danger 색이다', () => {
            expect(returnTextClass(5)).toBe('text-ui-success-text');
            expect(returnTextClass(-5)).toBe('text-ui-danger-text');
        });

        it('정확히 0%는 중립색(text-secondary-400)이다', () => {
            expect(returnTextClass(0)).toBe('text-secondary-400');
        });
    });

    describe('currentMarkerClass', () => {
        it('평단이 있으면 부호를 따른다', () => {
            expect(currentMarkerClass(5, true)).toBe('text-ui-success-text');
            expect(currentMarkerClass(-5, true)).toBe('text-ui-danger-text');
            expect(currentMarkerClass(0, true)).toBe('text-secondary-100');
        });

        it('평단이 없으면 부호와 무관하게 중립색이다', () => {
            const neutral = currentMarkerClass(0, false);
            expect(neutral).toBe('text-secondary-100');
            expect(currentMarkerClass(5, false)).toBe(neutral);
            expect(currentMarkerClass(-5, false)).toBe(neutral);
        });
    });
});
