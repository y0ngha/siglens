import { CATEGORY_LABEL_KEY } from '@/widgets/fundamental/utils/categoryLabelKey';

describe('CATEGORY_LABEL_KEY', () => {
    it('모든 카테고리가 fundamentalCategory 그룹 키를 가진다', () => {
        expect(Object.keys(CATEGORY_LABEL_KEY).sort()).toEqual([
            'futureDirection',
            'growth',
            'health',
            'profitability',
            'valuation',
        ]);
        for (const [category, key] of Object.entries(CATEGORY_LABEL_KEY)) {
            expect(key).toBe(`fundamentalCategory.${category}`);
        }
    });
});
