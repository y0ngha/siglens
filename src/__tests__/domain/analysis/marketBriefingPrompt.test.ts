import { buildMarketBriefingPrompt } from '@/domain/analysis/marketBriefingPrompt';
import type { MarketIndexData, MarketSectorData } from '@/domain/types';

const indices: MarketIndexData[] = [
    {
        symbol: 'GSPC',
        fmpSymbol: '^GSPC',
        displayName: 'S&P 500',
        koreanName: '미국 대형주 500',
        price: 5200.5,
        changesPercentage: 0.45,
    },
    {
        symbol: 'VIX',
        fmpSymbol: '^VIX',
        displayName: 'VIX',
        koreanName: '공포지수',
        price: 18.3,
        changesPercentage: -2.1,
    },
];

const sectors: MarketSectorData[] = [
    {
        symbol: 'XLK',
        sectorName: 'Technology',
        koreanName: '기술',
        price: 210.0,
        changesPercentage: 1.2,
    },
    {
        symbol: 'XLE',
        sectorName: 'Energy',
        koreanName: '에너지',
        price: 88.5,
        changesPercentage: -0.75,
    },
];

describe('buildMarketBriefingPrompt 함수는', () => {
    describe('지수 데이터를 올바르게 포함할 때', () => {
        it('지수 displayName과 가격을 포함한다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(prompt).toContain('S&P 500');
            expect(prompt).toContain('5200.50');
        });

        it('양수 changesPercentage에 + 부호를 붙인다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(prompt).toContain('+0.45%');
        });

        it('음수 changesPercentage에는 + 부호를 붙이지 않는다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(prompt).toContain('-2.10%');
        });
    });

    describe('섹터 데이터를 올바르게 포함할 때', () => {
        it('섹터명을 포함한다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(prompt).toContain('Technology');
            expect(prompt).toContain('Energy');
        });

        it('섹터 양수 등락률에 + 부호를 붙인다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(prompt).toContain('+1.20%');
        });

        it('섹터 음수 등락률에는 + 부호를 붙이지 않는다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(prompt).toContain('-0.75%');
        });
    });

    describe('프롬프트 구조일 때', () => {
        it('문자열을 반환한다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(typeof prompt).toBe('string');
        });

        it('Korean 존댓말 지시를 포함한다', () => {
            const prompt = buildMarketBriefingPrompt(indices, sectors);
            expect(prompt).toContain('Korean');
            expect(prompt).toContain('존댓말');
        });

        it('빈 배열이어도 에러 없이 동작한다', () => {
            expect(() => buildMarketBriefingPrompt([], [])).not.toThrow();
        });
    });
});
