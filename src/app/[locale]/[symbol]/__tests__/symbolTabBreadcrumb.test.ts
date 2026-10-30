import { describe, expect, it } from 'vitest';
import { getTranslations } from 'next-intl/server';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import { SITE_URL } from '@/shared/lib/seo';

describe('buildSymbolTabBreadcrumbJsonLd', () => {
    it('사이트 → 종목 → 탭 3단계이고, 탭 이름은 로케일의 shared.symbolTab 문구다', async () => {
        const tSeo = await getTranslations({
            locale: 'en',
            namespace: 'shared.seo',
        });
        const tTab = await getTranslations({
            locale: 'en',
            namespace: 'shared.symbolTab',
        });

        const node = await buildSymbolTabBreadcrumbJsonLd({
            ticker: 'AAPL',
            displayName: 'Apple Inc. (AAPL)',
            tab: 'news',
            tabUrl: `${SITE_URL}/AAPL/news`,
            tSeo,
            locale: 'en',
        });

        const trail = node.itemListElement as {
            position: number;
            name: string;
            item: string;
        }[];
        expect(trail.map(item => item.name)).toEqual([
            'SIGLENS',
            'Apple Inc. (AAPL)',
            tTab('news'),
        ]);
        expect(tTab('news')).toBe('News');
        expect(trail[1].item).toBe(`${SITE_URL}/en/AAPL`);
        expect(trail[2].item).toBe(`${SITE_URL}/en/AAPL/news`);
    });
});
