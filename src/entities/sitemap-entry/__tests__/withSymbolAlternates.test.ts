import { SITE_URL } from '@/shared/lib/seo';

import type { SitemapEntry } from '../model';
import { withSymbolAlternates } from '../lib/withSymbolAlternates';

const mocks = vi.hoisted(() => ({ locales: ['ko'] as string[] }));

vi.mock('@/shared/i18n/indexableLocales', () => ({
    get SYMBOL_INDEXABLE_LOCALES(): string[] {
        return mocks.locales;
    },
}));

const ENTRY: SitemapEntry = {
    url: `${SITE_URL}/AAPL/news`,
    lastModified: new Date('2026-08-20T00:00:00.000Z'),
    changeFrequency: 'hourly',
    priority: 0.78,
};

describe('withSymbolAlternates', () => {
    beforeEach(() => {
        mocks.locales = ['ko'];
    });

    it('색인 로케일이 하나면 엔트리를 그대로 돌려준다 — XML 바이트가 변하지 않는다', () => {
        expect(withSymbolAlternates([ENTRY])).toEqual([ENTRY]);
        expect(withSymbolAlternates([ENTRY])[0]).not.toHaveProperty(
            'alternates'
        );
    });

    it('색인 로케일이 여럿이면 SITE_URL을 뗀 경로로 hreflang 맵을 붙인다', () => {
        mocks.locales = ['ko', 'en'];

        expect(withSymbolAlternates([ENTRY])[0]?.alternates).toEqual({
            ko: `${SITE_URL}/AAPL/news`,
            en: `${SITE_URL}/en/AAPL/news`,
            'x-default': `${SITE_URL}/AAPL/news`,
        });
    });

    it('입력 엔트리를 변경하지 않는다', () => {
        mocks.locales = ['ko', 'en'];
        withSymbolAlternates([ENTRY]);

        expect(ENTRY).not.toHaveProperty('alternates');
    });
});
