import { describe, it, expect } from 'vitest';
import {
    ECONOMY_INDICATORS,
    ECONOMY_INDICATOR_CATEGORIES,
    INDICATOR_TREND_LENGTH,
} from '@/shared/config/economyIndicators';

describe('economyIndicators registry', () => {
    it('FMP 실측 9종 지표를 카테고리와 함께 정의', () => {
        // economic-indicators 9 (treasury 2Y/10Y는 별도 endpoint로 처리)
        const names = ECONOMY_INDICATORS.map(i => i.name);
        expect(names).toEqual([
            'federalFunds',
            'inflationRate',
            'CPI',
            'GDP',
            'industrialProductionTotalIndex',
            'smoothedUSRecessionProbabilities',
            'unemploymentRate',
            'totalNonfarmPayroll',
            'initialClaims',
        ]);
    });

    it('모든 지표가 유효 카테고리 키에 속함', () => {
        const cats = new Set(ECONOMY_INDICATOR_CATEGORIES.map(c => c.key));
        expect(ECONOMY_INDICATORS.every(i => cats.has(i.category))).toBe(true);
    });

    it('카테고리는 4종(금리·물가·성장·고용)', () => {
        expect(ECONOMY_INDICATOR_CATEGORIES.map(c => c.key)).toEqual([
            'rates',
            'inflation',
            'growth',
            'labor',
        ]);
    });

    it('레지스트리 메타에 라벨·단위·precision·툴팁 모두 존재', () => {
        for (const meta of ECONOMY_INDICATORS) {
            expect(meta.label).toMatch(/.+/);
            expect(meta.unit).toMatch(/.+/);
            expect(meta.precision).toBeGreaterThanOrEqual(0);
            expect(meta.tooltip).toMatch(/.+/);
        }
    });

    it('지표 name은 unique', () => {
        const names = ECONOMY_INDICATORS.map(i => i.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it('추세 길이는 양수 상수', () => {
        expect(INDICATOR_TREND_LENGTH).toBeGreaterThan(0);
    });
});
