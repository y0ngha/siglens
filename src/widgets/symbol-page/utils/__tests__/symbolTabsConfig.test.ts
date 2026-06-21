import { describe, it, expect } from 'vitest';
import { TABS, tabsFor } from '../symbolTabsConfig';

describe('tabsFor', () => {
    it('returns all tabs for us-equity', () => {
        expect(tabsFor('us-equity').map(t => t.key)).toEqual(
            TABS.map(t => t.key)
        );
    });

    it('returns only crypto-applicable tabs for crypto', () => {
        expect(tabsFor('crypto').map(t => t.key)).toEqual([
            'chart',
            'news',
            'fear-greed',
            'overall',
        ]);
    });
});
