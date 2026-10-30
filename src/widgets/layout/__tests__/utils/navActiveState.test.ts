import { NAV_TREE } from '@/widgets/layout/utils/headerNavTree';
import {
    isHrefActive,
    isPathWithin,
    isVerticalActive,
} from '@/widgets/layout/utils/navActiveState';

describe('isPathWithin', () => {
    it('matches the root itself', () => {
        expect(isPathWithin('/guide', '/guide')).toBe(true);
    });

    it('matches a descendant path', () => {
        expect(isPathWithin('/guide', '/guide/rsi')).toBe(true);
    });

    it('does not match a sibling that merely shares the prefix', () => {
        expect(isPathWithin('/guide', '/guidebook')).toBe(false);
    });

    it('does not match a parent or unrelated path', () => {
        expect(isPathWithin('/guide/rsi', '/guide')).toBe(false);
        expect(isPathWithin('/guide', '/news')).toBe(false);
    });

    it('is false when the path is unknown', () => {
        expect(isPathWithin('/guide', null)).toBe(false);
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
