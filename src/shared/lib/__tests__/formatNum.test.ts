import { describe, expect, it } from 'vitest';

import { formatNum } from '../formatNum';

describe('formatNum', () => {
    it('null → "N/A" (단위 무관)', () => {
        expect(formatNum(null, '원')).toBe('N/A');
        expect(formatNum(null, '%')).toBe('N/A');
    });

    it('0 → "0<unit>"', () => {
        expect(formatNum(0, '원')).toBe('0원');
    });

    it('1500 → ko-KR 천 단위 구분자 + 단위', () => {
        expect(formatNum(1500, '원')).toBe('1,500원');
    });

    it('음수 포맷 → "-N,NNN<unit>"', () => {
        // Intl.NumberFormat('ko-KR').format(-1234) = '-1,234'
        expect(formatNum(-1234, '%')).toBe('-1,234%');
    });

    it('NaN → "NaN<unit>" (Intl.NumberFormat은 NaN을 "NaN"으로 직렬화)', () => {
        // NaN은 null이 아니므로 N/A를 반환하지 않고 format(NaN) 결과를 반환한다.
        const result = formatNum(NaN, '원');
        expect(result).toBe('NaN원');
    });

    it('단위가 빈 문자열이면 숫자만 반환', () => {
        expect(formatNum(42, '')).toBe('42');
    });
});
