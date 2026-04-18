import { normalizeMarketBriefing } from '@/domain/analysis/normalizeMarketBriefing';

describe('normalizeMarketBriefing 함수는', () => {
    describe('완전한 입력이 주어졌을 때', () => {
        it('모든 필드를 올바르게 정규화한다', () => {
            const raw = {
                summary: '시장이 강세를 보이고 있습니다.',
                dominantThemes: ['기술주 강세', '에너지 약세'],
                sectorAnalysis: {
                    leadingSectors: ['XLK', 'XLF'],
                    laggingSectors: ['XLE'],
                    performanceDescription: '기술 섹터가 시장을 주도했습니다.',
                },
                volatilityAnalysis: {
                    vixLevel: 17.48,
                    description: '변동성이 안정적입니다.',
                },
                riskSentiment: '위험 선호 심리가 우세합니다.',
            };

            const result = normalizeMarketBriefing(raw);

            expect(result).toEqual({
                summary: '시장이 강세를 보이고 있습니다.',
                dominantThemes: ['기술주 강세', '에너지 약세'],
                sectorAnalysis: {
                    leadingSectors: ['XLK', 'XLF'],
                    laggingSectors: ['XLE'],
                    performanceDescription: '기술 섹터가 시장을 주도했습니다.',
                },
                volatilityAnalysis: {
                    vixLevel: 17.48,
                    description: '변동성이 안정적입니다.',
                },
                riskSentiment: '위험 선호 심리가 우세합니다.',
            });
        });
    });

    describe('필드가 누락된 입력이 주어졌을 때', () => {
        it('summary가 없으면 빈 문자열을 반환한다', () => {
            const result = normalizeMarketBriefing({});
            expect(result.summary).toBe('');
        });

        it('dominantThemes가 없으면 빈 배열을 반환한다', () => {
            const result = normalizeMarketBriefing({});
            expect(result.dominantThemes).toEqual([]);
        });

        it('sectorAnalysis가 없으면 기본값을 반환한다', () => {
            const result = normalizeMarketBriefing({});
            expect(result.sectorAnalysis).toEqual({
                leadingSectors: [],
                laggingSectors: [],
                performanceDescription: '',
            });
        });

        it('volatilityAnalysis.vixLevel이 없으면 undefined를 반환한다', () => {
            const result = normalizeMarketBriefing({
                volatilityAnalysis: { description: '설명' },
            });
            expect(result.volatilityAnalysis.vixLevel).toBeUndefined();
            expect(result.volatilityAnalysis.description).toBe('설명');
        });

        it('riskSentiment가 없으면 빈 문자열을 반환한다', () => {
            const result = normalizeMarketBriefing({});
            expect(result.riskSentiment).toBe('');
        });
    });

    describe('비정상 입력이 주어졌을 때', () => {
        it('null이면 모든 필드를 기본값으로 반환한다', () => {
            const result = normalizeMarketBriefing(null);
            expect(result).toEqual({
                summary: '',
                dominantThemes: [],
                sectorAnalysis: {
                    leadingSectors: [],
                    laggingSectors: [],
                    performanceDescription: '',
                },
                volatilityAnalysis: { vixLevel: undefined, description: '' },
                riskSentiment: '',
            });
        });

        it('배열이면 모든 필드를 기본값으로 반환한다', () => {
            const result = normalizeMarketBriefing([1, 2, 3]);
            expect(result.summary).toBe('');
            expect(result.dominantThemes).toEqual([]);
        });

        it('문자열이면 모든 필드를 기본값으로 반환한다', () => {
            const result = normalizeMarketBriefing('invalid');
            expect(result.summary).toBe('');
        });

        it('dominantThemes 배열 내 비문자열 값은 필터링된다', () => {
            const result = normalizeMarketBriefing({
                dominantThemes: ['valid', 42, null, 'also valid'],
            });
            expect(result.dominantThemes).toEqual(['valid', 'also valid']);
        });
    });
});
