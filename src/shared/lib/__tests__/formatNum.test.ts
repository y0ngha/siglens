import { describe, expect, it } from 'vitest';

import { formatFixed, formatNum } from '../formatNum';

describe('formatNum', () => {
    it('null → "N/A" (단위 무관)', () => {
        expect(formatNum(null, '원', 'ko')).toBe('N/A');
        expect(formatNum(null, '%', 'ko')).toBe('N/A');
    });

    it('0 → "0<unit>"', () => {
        expect(formatNum(0, '원', 'ko')).toBe('0원');
    });

    it('1500 → ko-KR 천 단위 구분자 + 단위', () => {
        expect(formatNum(1500, '원', 'ko')).toBe('1,500원');
    });

    it('음수 포맷 → "-N,NNN<unit>"', () => {
        // Intl.NumberFormat('ko-KR').format(-1234) = '-1,234'
        expect(formatNum(-1234, '%', 'ko')).toBe('-1,234%');
    });

    it('NaN → "N/A" (비유한수 가드)', () => {
        expect(formatNum(NaN, '원', 'ko')).toBe('N/A');
    });

    it('Infinity → "N/A" (비유한수 가드)', () => {
        expect(formatNum(Infinity, '%', 'ko')).toBe('N/A');
    });

    it('-Infinity → "N/A" (비유한수 가드)', () => {
        expect(formatNum(-Infinity, '%', 'ko')).toBe('N/A');
    });

    it('단위가 빈 문자열이면 숫자만 반환', () => {
        expect(formatNum(42, '', 'ko')).toBe('42');
    });

    it.each(['en', 'ja', 'zh'] as const)(
        '%s: 로케일 포매터로 천 단위 구분자를 넣는다',
        locale => {
            expect(formatNum(1500, '%', locale)).toBe('1,500%');
        }
    );
});

describe('formatFixed', () => {
    it('천 단위 구분자를 붙인다', () => {
        expect(formatFixed(159044, 0, 'ko')).toBe('159,044');
        expect(formatFixed(1234567.891, 1, 'en')).toBe('1,234,567.9');
    });

    it('자릿수를 고정한다 (최소 = 최대) — 끝자리 0을 지키고 넘치면 반올림한다', () => {
        expect(formatFixed(3.6, 2, 'ko')).toBe('3.60');
        expect(formatFixed(3.634, 2, 'ko')).toBe('3.63');
        expect(formatFixed(3.635, 1, 'en')).toBe('3.6');
        expect(formatFixed(5, 0, 'en')).toBe('5');
    });

    it('음수는 부호를 유지한다', () => {
        expect(formatFixed(-0.4, 1, 'ko')).toBe('-0.4');
        expect(formatFixed(-6000, 0, 'en')).toBe('-6,000');
    });

    it('로케일 규칙을 따른다 (INTL_LOCALE)', () => {
        expect(formatFixed(1234.5, 2, 'ja')).toBe('1,234.50');
        expect(formatFixed(1234.5, 2, 'zh')).toBe('1,234.50');
    });

    it('단위 접미사를 붙이지 않는다', () => {
        expect(formatFixed(2.5, 1, 'ko')).not.toMatch(/[^\d.,-]/);
    });
});
