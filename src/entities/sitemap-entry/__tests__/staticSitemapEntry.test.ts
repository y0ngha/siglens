import { SITE_URL } from '@/shared/lib/seo';

import { staticSitemapEntry } from '../lib/staticSitemapEntry';

describe('staticSitemapEntry', () => {
    const AT = new Date('2026-08-20T00:00:00.000Z');

    it('SITE_URL에 경로를 붙인 엔트리를 만든다', () => {
        expect(staticSitemapEntry('/about', AT, 'yearly', 0.4)).toEqual({
            url: `${SITE_URL}/about`,
            lastModified: AT,
            changeFrequency: 'yearly',
            priority: 0.4,
            alternates: undefined,
        });
    });
});
