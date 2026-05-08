import { formatConfidenceFooter, formatFactorRaw } from '@/lib/fearGreedLabels';

describe('formatFactorRaw', () => {
    it('volume_z는 소수 둘째 자리 일반 포맷으로 출력한다', () => {
        expect(formatFactorRaw('volume_z', 1.2345)).toBe('1.23');
        expect(formatFactorRaw('volume_z', -2.5)).toBe('-2.50');
    });

    it.each([
        ['buysell_imbalance' as const, 0.123],
        ['range_position' as const, 0.876],
    ])('%s는 1dp 퍼센트로 출력한다', (key, raw) => {
        const result = formatFactorRaw(key, raw);
        expect(result).toMatch(/^-?\d+\.\d%$/);
    });

    it.each([
        ['poc_distance' as const, 0.0512],
        ['ma200_distance' as const, -0.0314],
    ])('%s는 2dp 퍼센트로 출력한다', (key, raw) => {
        const result = formatFactorRaw(key, raw);
        expect(result).toMatch(/^-?\d+\.\d{2}%$/);
    });
});

describe('formatConfidenceFooter', () => {
    it('confidence가 normal이면 "정상 산출" 라벨로 출력한다', () => {
        expect(formatConfidenceFooter(200, 'normal')).toBe(
            '표본 200 — 정상 산출'
        );
    });

    it('confidence가 limited이면 "신뢰도 제한" 라벨로 출력한다', () => {
        expect(formatConfidenceFooter(45, 'limited')).toBe(
            '표본 45 — 신뢰도 제한'
        );
    });
});
