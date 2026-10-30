import { describe, expect, it } from 'vitest';
import { buildCategoryTabs } from '../../utils/categoryTabs';

describe('buildCategoryTabs', () => {
    it('같은 지역 카테고리를 선언 순서대로 경로·라벨 키와 함께 돌려준다', () => {
        expect(buildCategoryTabs('forex')).toEqual([
            {
                category: 'general',
                href: '/news/general',
                labelKey: 'general.shortLabel',
                active: false,
            },
            {
                category: 'stock',
                href: '/news/stock',
                labelKey: 'stock.shortLabel',
                active: false,
            },
            {
                category: 'forex',
                href: '/news/forex',
                labelKey: 'forex.shortLabel',
                active: true,
            },
            {
                category: 'articles',
                href: '/news/articles',
                labelKey: 'articles.shortLabel',
                active: false,
            },
        ]);
    });

    it.each(['kr', 'crypto'] as const)(
        '카테고리가 하나뿐인 지역(%s)은 빈 배열이다',
        category => {
            expect(buildCategoryTabs(category)).toEqual([]);
        }
    );
});
