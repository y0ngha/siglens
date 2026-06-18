import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '../headerNavItems';

describe('NAV_ITEMS', () => {
    it('exposes the three primary top-level destinations', () => {
        const hrefs = NAV_ITEMS.map(item => item.href);
        expect(hrefs).toEqual(['/market', '/news', '/economy']);
    });

    it('includes the /economy page so the macro hub is reachable from the header', () => {
        const economy = NAV_ITEMS.find(item => item.href === '/economy');
        expect(economy).toBeDefined();
        expect(economy?.label).toBe('미국 경제');
    });

    it('pins the exact label for every nav item', () => {
        expect(NAV_ITEMS.map(i => i.label)).toEqual([
            '시장 분석',
            '마켓 뉴스',
            '미국 경제',
        ]);
    });
});
