import { CATEGORY_LABEL_KEY } from '@/widgets/fundamental/utils/categoryLabelKey';

describe('CATEGORY_LABEL_KEY', () => {
    it('각 카테고리를 shared.enumLabel의 카탈로그 키로 옮긴다', () => {
        expect(CATEGORY_LABEL_KEY).toEqual({
            valuation: 'fundamentalCategory.valuation',
            profitability: 'fundamentalCategory.profitability',
            growth: 'fundamentalCategory.growth',
            health: 'fundamentalCategory.health',
            futureDirection: 'fundamentalCategory.futureDirection',
        });
    });
});
