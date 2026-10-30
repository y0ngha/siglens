import { describe, expect, it } from 'vitest';
import { formatMetricValue } from '@/widgets/financials/utils/metricFormat';

describe('formatMetricValue', () => {
    it('값이 없으면 대시다', () => {
        expect(formatMetricValue(null, 'pct', 'USD', 'ko')).toBe('-');
    });

    it('단위별로 포맷한다', () => {
        expect(formatMetricValue(12.527, 'pct', 'USD', 'ko')).toBe('12.5%');
        expect(formatMetricValue(2.13682, 'ratio', 'USD', 'ko')).toBe('2.14x');
        expect(formatMetricValue(84.6, 'score', 'USD', 'ko')).toBe('85');
    });

    it('금액 단위는 통화를 따른다', () => {
        expect(formatMetricValue(5_000_000_000, 'usd', 'USD', 'en')).toBe(
            '$5B'
        );
        expect(formatMetricValue(5_000_000_000, 'usd', 'TWD', 'en')).toContain(
            'TWD'
        );
    });
});
