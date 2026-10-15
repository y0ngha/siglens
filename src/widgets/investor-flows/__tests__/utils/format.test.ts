import { describe, expect, it } from 'vitest';
import {
    formatCompact,
    formatMonthDay,
    formatPercent,
    formatPeriodShort,
    formatSignedCompact,
    formatSignedDecimal,
    formatSignedPercent,
    formatSignedUsdCompact,
    formatUsdCompact,
} from '../../utils/flowFormat';
import { buildLineGeometry, segmentToPath } from '../../utils/linePath';

describe('flowFormat', () => {
    it('부호를 항상 붙인다(0은 제외)', () => {
        expect(formatSignedCompact(142_000_000, 'en')).toBe('+142M');
        expect(formatSignedCompact(-48_000_000, 'en')).toBe('-48M');
        expect(formatSignedCompact(0, 'en')).toBe('0');
    });

    it('로케일에 맞는 축약을 쓴다', () => {
        expect(formatCompact(142_000_000, 'ko')).toBe('1.4억');
    });

    it('달러·퍼센트 포맷', () => {
        expect(formatUsdCompact(1_200_000, 'en')).toBe('$1.2M');
        expect(formatUsdCompact(-300_000, 'en')).toBe('-$300K');
        expect(formatSignedUsdCompact(2_500, 'en')).toBe('+$2.5K');
        expect(formatPercent(12.34, 'en')).toBe('12.3%');
        expect(formatSignedPercent(-0.44, 'en')).toBe('-0.4%');
        expect(formatSignedPercent(0, 'en')).toBe('0.0%');
    });

    it('formatSignedDecimal은 반올림해서 0이면 부호를 붙이지 않는다', () => {
        expect(formatSignedDecimal(5.42, 'en')).toBe('+5.4');
        expect(formatSignedDecimal(-0.04, 'en')).toBe('0.0');
    });

    it('날짜 축약, 형식이 이상하면 원문', () => {
        expect(formatPeriodShort('2026-06-30')).toBe("'26.06");
        expect(formatPeriodShort('bad')).toBe('bad');
        expect(formatMonthDay('2026-06-30')).toBe('06-30');
        expect(formatMonthDay('x')).toBe('x');
    });
});

describe('linePath', () => {
    it('값이 모두 null이면 null이다', () => {
        expect(buildLineGeometry([null, null], null)).toBeNull();
    });

    it('같은 값이면 한가운데 수평선이다', () => {
        const g = buildLineGeometry([5, 5, 5], null)!;
        expect(g.segments[0].every(p => p.y === 50)).toBe(true);
    });

    it('null에서 선을 끊고 평균선 y를 계산한다', () => {
        const g = buildLineGeometry([1, null, 3], 2)!;
        expect(g.segments).toHaveLength(2);
        expect(g.averageY).toBeCloseTo(50);
        expect(g.last?.x).toBe(100);
    });

    it('값이 하나면 x=50이고 path는 M으로 시작한다', () => {
        const g = buildLineGeometry([7], null)!;
        expect(g.segments[0][0].x).toBe(50);
        expect(segmentToPath(g.segments[0])).toMatch(/^M50\.00/);
    });
});
