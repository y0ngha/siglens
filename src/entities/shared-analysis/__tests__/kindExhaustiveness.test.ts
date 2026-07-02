import { SHAREABLE_KIND_VALUES } from '@/shared/db/constants';
import { TABS } from '@/views/symbol/utils/symbolTabsConfig';

describe('shareable kind exhaustiveness', () => {
    it('every shareable kind maps to a known tab key', () => {
        const tabKeys = new Set(TABS.map(t => t.key));
        for (const kind of SHAREABLE_KIND_VALUES) {
            expect(tabKeys.has(kind)).toBe(true);
        }
    });
});
