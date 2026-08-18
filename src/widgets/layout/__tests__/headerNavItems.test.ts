import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '../headerNavItems';

describe('NAV_ITEMS', () => {
    it('exposes the four primary top-level destinations', () => {
        const hrefs = NAV_ITEMS.map(item => item.href);
        expect(hrefs).toEqual(['/market', '/fear-greed', '/news', '/economy']);
    });

    it('pins the exact label for every nav item', () => {
        expect(NAV_ITEMS.map(i => i.label)).toEqual([
            '미국 시장 분석',
            '미국 공포·탐욕 지수',
            '미국 시장 뉴스',
            '미국 경제',
        ]);
    });
});
