import { GUIDE_CATEGORIES, isGuideCategory } from '@/entities/guide/types';

describe('guide categories', () => {
    it('howto가 첫 번째 카테고리다 — 허브 타일·카탈로그 정렬이 이 순서를 따른다', () => {
        expect(GUIDE_CATEGORIES[0]).toBe('howto');
        expect(GUIDE_CATEGORIES).toEqual([
            'howto',
            'candlesticks',
            'chart-patterns',
            'indicators',
            'strategies',
        ]);
    });

    it('isGuideCategory가 howto를 받아들이고 모르는 값은 거부한다', () => {
        expect(isGuideCategory('howto')).toBe(true);
        expect(isGuideCategory('learn')).toBe(false);
        expect(isGuideCategory(undefined)).toBe(false);
    });
});
