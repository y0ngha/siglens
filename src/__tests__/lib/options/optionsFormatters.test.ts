import {
    formatAtmIv,
    formatImpliedMove,
    formatMaxPain,
    formatPutCallRatio,
} from '@/lib/options/optionsFormatters';

describe('formatMaxPain', () => {
    it('NaN을 em dash로 표현한다', () => {
        expect(formatMaxPain(NaN)).toBe('—');
    });

    it('정수 strike를 천 단위 콤마와 함께 표시한다', () => {
        expect(formatMaxPain(1234)).toBe('$1,234');
    });

    it('소수점 strike는 반올림하여 정수로 표시한다', () => {
        expect(formatMaxPain(199.6)).toBe('$200');
    });

    it('큰 strike도 콤마 그룹핑된다', () => {
        expect(formatMaxPain(1_234_567)).toBe('$1,234,567');
    });
});

describe('formatPutCallRatio', () => {
    it('+Infinity를 ∞ 기호로 표시한다 (콜 OI가 0일 때)', () => {
        expect(formatPutCallRatio(Number.POSITIVE_INFINITY)).toBe('∞');
    });

    it('NaN을 em dash로 표현한다 (양쪽 OI가 0일 때)', () => {
        expect(formatPutCallRatio(NaN)).toBe('—');
    });

    it('일반 비율은 소수점 두 자리로 표시한다', () => {
        expect(formatPutCallRatio(1.234)).toBe('1.23');
    });

    it('0 비율도 정상적으로 표시한다', () => {
        expect(formatPutCallRatio(0)).toBe('0.00');
    });
});

describe('formatAtmIv', () => {
    it('null을 em dash로 표현한다', () => {
        expect(formatAtmIv(null)).toBe('—');
    });

    it('NaN을 em dash로 표현한다', () => {
        expect(formatAtmIv(NaN)).toBe('—');
    });

    it('0.28 fraction을 28.0% 형식으로 표시한다', () => {
        expect(formatAtmIv(0.28)).toBe('28.0%');
    });

    it('소수점 첫째 자리까지 반올림한다', () => {
        expect(formatAtmIv(0.123456)).toBe('12.3%');
    });
});

describe('formatImpliedMove', () => {
    it('null을 em dash로 표현한다', () => {
        expect(formatImpliedMove(null)).toBe('—');
    });

    it('NaN을 em dash로 표현한다', () => {
        expect(formatImpliedMove(NaN)).toBe('—');
    });

    it('± 기호와 소수점 첫째 자리로 표시한다', () => {
        expect(formatImpliedMove(4.2)).toBe('±4.2%');
    });

    it('0% 움직임도 정상 표시', () => {
        expect(formatImpliedMove(0)).toBe('±0.0%');
    });
});
