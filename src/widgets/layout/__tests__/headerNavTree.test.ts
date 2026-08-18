import { NAV_TREE } from '../headerNavTree';
import { isHrefActive, isVerticalActive } from '../navActiveState';
import { NAV_VERTICALS } from '@/shared/config/assetClassNav';
import { CATEGORY_CONFIG, categoriesInRegion } from '@/entities/market-news';

describe('NAV_TREE', () => {
    it('mirrors the vertical/region skeleton exactly', () => {
        expect(NAV_TREE.map(v => v.id)).toEqual(NAV_VERTICALS.map(v => v.id));
        for (const [i, vertical] of NAV_TREE.entries()) {
            expect(vertical.regions.map(r => r.href)).toEqual(
                NAV_VERTICALS[i].regions.map(r => r.href)
            );
        }
    });

    it('expands US news categories as second-level destinations', () => {
        // 지역 허브를 한 번 더 거치지 않고 헤더에서 곧장 카테고리로 가는 것이
        // 이 트리의 존재 이유다.
        const usNews = NAV_TREE.find(v => v.id === 'news')?.regions.find(
            r => r.region === 'us'
        );
        expect(usNews?.children.map(c => c.href)).toEqual(
            categoriesInRegion('us').map(
                c => `/news/${CATEGORY_CONFIG[c].slug}`
            )
        );
    });

    it('leaves single-category regions childless', () => {
        // 지역 링크와 똑같은 목적지 하나를 자식으로 또 그리면 같은 줄이 두 번 나온다.
        for (const vertical of NAV_TREE) {
            for (const region of vertical.regions) {
                if (vertical.id === 'news' && region.region === 'us') continue;
                expect(region.children).toEqual([]);
            }
        }
    });

    it('never repeats an href anywhere in the tree', () => {
        const hrefs = NAV_TREE.flatMap(v =>
            v.regions.flatMap(r => [r.href, ...r.children.map(c => c.href)])
        );
        expect(new Set(hrefs).size).toBe(hrefs.length);
    });
});

describe('isHrefActive', () => {
    it('matches only on exact equality', () => {
        // `/market`은 `/market/kr`의 접두사다 — 접두사 매칭이면 한국 페이지에서
        // 미국 항목도 활성이 되어 지역을 나눈 목적이 화면에서 사라진다.
        expect(isHrefActive('/market', '/market')).toBe(true);
        expect(isHrefActive('/market', '/market/kr')).toBe(false);
        expect(isHrefActive('/market', null)).toBe(false);
    });
});

describe('isVerticalActive', () => {
    const market = NAV_TREE.find(v => v.id === 'market')!;
    const news = NAV_TREE.find(v => v.id === 'news')!;

    it('activates on any of its own region hrefs', () => {
        expect(isVerticalActive(market, '/market')).toBe(true);
        expect(isVerticalActive(market, '/market/kr')).toBe(true);
    });

    it('activates on a second-level destination', () => {
        expect(isVerticalActive(news, '/news/stock')).toBe(true);
    });

    it('activates on a child route that is not in the tree', () => {
        // 앞으로 추가될 카테고리에서도 1단 메뉴가 활성으로 보여야 한다.
        expect(isVerticalActive(news, '/news/some-future-slug')).toBe(true);
    });

    it('does not activate on another vertical', () => {
        expect(isVerticalActive(market, '/news')).toBe(false);
        expect(isVerticalActive(news, '/market/kr')).toBe(false);
    });

    it('does not activate when the path is unknown', () => {
        expect(isVerticalActive(market, null)).toBe(false);
    });
});
