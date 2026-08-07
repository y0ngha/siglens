import { toRemovalUrlSetXml } from '../lib/removalXml';
import type { RemovalSitemapEntry } from '../model';

describe('toRemovalUrlSetXml', () => {
    describe('when an entry URL contains an ampersand', () => {
        it('emits an escaped URL and date-only lastmod in a urlset', () => {
            const entries: RemovalSitemapEntry[] = [
                {
                    url: 'https://siglens.io/A&B',
                    lastModified: new Date('2026-07-08T00:00:00.000Z'),
                },
            ];

            const xml = toRemovalUrlSetXml(entries);

            expect(xml).toMatch(
                /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/
            );
            expect(xml).toContain('<loc>https://siglens.io/A&amp;B</loc>');
            expect(xml).toContain('<lastmod>2026-07-08</lastmod>');
            expect(xml).not.toContain('<priority>');
            expect(xml).not.toContain('<changefreq>');
            expect(xml).toMatch(/<\/urlset>$/);
        });
    });
});
