import { describe, it, expect } from 'vitest';
import { buildChartPageHeading } from '@/views/symbol/utils/chartPageHeading';

describe('buildChartPageHeading', () => {
    it('displayName 뒤에 " 차트 분석" suffix를 붙인다 (SSR fallback h1 / 가시 h1 단일 소스)', () => {
        expect(buildChartPageHeading('애플, Apple Inc. (AAPL)')).toBe(
            '애플, Apple Inc. (AAPL) 차트 분석'
        );
    });
});
