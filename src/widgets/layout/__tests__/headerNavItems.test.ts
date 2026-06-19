import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '../headerNavItems';

describe('NAV_ITEMS', () => {
    it('exposes the three primary top-level destinations', () => {
        const hrefs = NAV_ITEMS.map(item => item.href);
        expect(hrefs).toEqual(['/market', '/news', '/economy']);
    });

    it('pins the exact label for every nav item', () => {
        expect(NAV_ITEMS.map(i => i.label)).toEqual([
            '시장 분석',
            '마켓 뉴스',
            '미국 경제',
        ]);
    });
});
