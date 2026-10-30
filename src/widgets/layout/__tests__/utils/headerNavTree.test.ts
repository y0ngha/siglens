import { NAV_TREE } from '@/widgets/layout/utils/headerNavTree';
import { NAV_VERTICALS } from '@/shared/config/assetClassNav';
import {
    CATEGORY_CONFIG,
    categoriesInRegion,
} from '@/entities/market-news/lib/categoryConfig';

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
