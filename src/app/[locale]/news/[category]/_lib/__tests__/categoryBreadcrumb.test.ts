import { describe, expect, it } from 'vitest';
import {
    categoryBreadcrumbTrail,
    toVisibleCrumbs,
} from '@/app/[locale]/news/[category]/_lib/categoryBreadcrumb';
import { CATEGORY_CONFIG } from '@/entities/market-news/lib/categoryConfig';

/** 키를 그대로 돌려주는 번역자 — 어느 키로 라벨을 풀었는지까지 단언한다. */
const echo = (key: string): string => `t:${key}`;

describe('categoryBreadcrumbTrail', () => {
    it('카테고리가 여럿인 지역은 허브 → 지역 허브 → 카테고리 3단계다', () => {
        expect(
            categoryBreadcrumbTrail(CATEGORY_CONFIG.stock, '/news/stock', echo)
        ).toEqual([
            { name: 't:app.news.page.dc06c4', path: '/news' },
            { name: 't:shared.config.nav.full.news.us', path: '/news/us' },
            {
                name: 't:entities.market-news.category.stock.label',
                path: '/news/stock',
            },
        ]);
    });

    it('지역 허브가 카테고리 페이지와 같은 URL이면 지역 마디를 뺀다', () => {
        expect(
            categoryBreadcrumbTrail(CATEGORY_CONFIG.kr, '/news/kr', echo).map(
                node => node.path
            )
        ).toEqual(['/news', '/news/kr']);
    });
});

describe('toVisibleCrumbs', () => {
    it('마지막 마디만 링크 없이 그린다', () => {
        expect(
            toVisibleCrumbs([
                { name: '허브', path: '/news' },
                { name: '미국', path: '/news/us' },
                { name: '주식', path: '/news/stock' },
            ])
        ).toEqual([
            { label: '허브', href: '/news' },
            { label: '미국', href: '/news/us' },
            { label: '주식' },
        ]);
    });
});
