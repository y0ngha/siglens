import {
    formatAtmIv,
    formatImpliedMove,
    formatMaxPain,
    formatPutCallRatio,
} from '@/lib/options/optionsFormatters';

describe('formatMaxPain', () => {
    it('null을 em dash로 표현한다 (siglens-core R12 이후 nullable contract)', () => {
        expect(formatMaxPain(null)).toBe('—');
    });

    it('undefined를 em dash로 표현한다', () => {
        expect(formatMaxPain(undefined)).toBe('—');
    });

    it('NaN을 em dash로 표현한다 (legacy 호환)', () => {
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

    it('null을 em dash로 표현한다 (siglens-core R12 이후 nullable contract)', () => {
        expect(formatPutCallRatio(null)).toBe('—');
    });

    it('undefined를 em dash로 표현한다', () => {
        expect(formatPutCallRatio(undefined)).toBe('—');
    });

    it('NaN을 em dash로 표현한다 (legacy 호환)', () => {
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

    it('undefined를 em dash로 표현한다', () => {
        expect(formatAtmIv(undefined)).toBe('—');
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

    it('0 fraction은 em dash로 표현한다 (Yahoo가 IV를 클리어한 케이스)', () => {
        // ATM contract의 IV가 0으로 들어오면 의미 있는 변동성이 아니므로
        // 사용자에게 "데이터 없음"으로 안내한다.
        expect(formatAtmIv(0)).toBe('—');
    });

    it('음수 fraction도 em dash로 표현한다 (방어적 가드)', () => {
        expect(formatAtmIv(-0.1)).toBe('—');
    });

    it('PERCENT_DISPLAY_FLOOR(0.05%) 미만 sub-percent noise는 em dash로 표현한다', () => {
        // value=0.0004 → pct=0.04 → pct < 0.05이므로 placeholder.
        // Yahoo가 pre-market에서 ATM IV를 0 또는 sub-percent로 채워 보내는
        // 경우의 noise 컷오프.
        expect(formatAtmIv(0.0004)).toBe('—');
    });

    it('PERCENT_DISPLAY_FLOOR(0.05%) 바로 위 값은 표시한다', () => {
        // value=0.0006 → pct=0.06 → floor(0.05) 초과 → "0.1%"로 반올림 표시.
        // FP 정밀도 이슈를 피해 경계값(0.0005)이 아닌 명확히 위 값으로 검증.
        expect(formatAtmIv(0.0006)).toBe('0.1%');
    });
});

describe('formatImpliedMove', () => {
    it('null을 em dash로 표현한다', () => {
        expect(formatImpliedMove(null)).toBe('—');
    });

    it('undefined를 em dash로 표현한다', () => {
        expect(formatImpliedMove(undefined)).toBe('—');
    });

    it('NaN을 em dash로 표현한다', () => {
        expect(formatImpliedMove(NaN)).toBe('—');
    });

    it('± 기호와 소수점 첫째 자리로 표시한다', () => {
        expect(formatImpliedMove(4.2)).toBe('±4.2%');
    });

    it('0%는 em dash로 표현한다 (ATM IV가 0이라 기대 변동성도 0인 케이스)', () => {
        // calculateImpliedMove(atmIv=0, ...) === 0 → "±0.0%"는 변동성이 정말
        // 0이라는 잘못된 인상을 주므로 placeholder로 대체한다.
        expect(formatImpliedMove(0)).toBe('—');
    });

    it('음수 implied move도 em dash로 표현한다 (방어적 가드)', () => {
        expect(formatImpliedMove(-1)).toBe('—');
    });

    it('PERCENT_DISPLAY_FLOOR(0.05) 미만 sub-percent noise는 em dash로 표현한다', () => {
        // value=0.04 → value < 0.05이므로 placeholder.
        // ATM IV가 sub-percent일 때 implied move도 같은 구간에서 노이즈로 떨어진다.
        expect(formatImpliedMove(0.04)).toBe('—');
    });

    it('PERCENT_DISPLAY_FLOOR(0.05) 바로 위 값은 표시한다', () => {
        // value=0.06 → floor(0.05) 초과 → "±0.1%"로 반올림 표시.
        // FP 정밀도 이슈를 피해 경계값(0.05)이 아닌 명확히 위 값으로 검증.
        expect(formatImpliedMove(0.06)).toBe('±0.1%');
    });
});
