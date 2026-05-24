import { toSitemapIndexXml, toUrlSetXml } from '@/infrastructure/sitemap/xml';
import type {
    SitemapEntry,
    SitemapIndexEntry,
} from '@/infrastructure/sitemap/types';

const FIXED_DATE = new Date('2026-05-23T10:00:00.000Z');

describe('toUrlSetXml', () => {
    it('빈 배열은 urlset 셸만 반환한다', () => {
        const xml = toUrlSetXml([]);
        expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        expect(xml).toContain('<urlset');
        expect(xml).toContain('</urlset>');
        expect(xml).not.toContain('<url>');
    });

    it('SitemapEntry를 urlset XML로 직렬화한다', () => {
        const entries: SitemapEntry[] = [
            {
                url: 'https://siglens.io/AAPL',
                lastModified: FIXED_DATE,
                changeFrequency: 'daily',
                priority: 0.8,
            },
        ];
        const xml = toUrlSetXml(entries);
        expect(xml).toContain('<loc>https://siglens.io/AAPL</loc>');
        expect(xml).toContain(`<lastmod>${FIXED_DATE.toISOString()}</lastmod>`);
        expect(xml).toContain('<changefreq>daily</changefreq>');
        expect(xml).toContain('<priority>0.8</priority>');
    });

    it('URL에 ampersand 등 특수문자가 있으면 XML 이스케이프한다', () => {
        const entries: SitemapEntry[] = [
            {
                url: 'https://siglens.io/?q=a&b=c',
                lastModified: FIXED_DATE,
                changeFrequency: 'weekly',
                priority: 0.5,
            },
        ];
        const xml = toUrlSetXml(entries);
        expect(xml).toContain('https://siglens.io/?q=a&amp;b=c');
        expect(xml).not.toContain('?q=a&b=c</loc>');
    });

    it('여러 엔트리는 url 블록을 순서대로 직렬화한다', () => {
        const entries: SitemapEntry[] = [
            {
                url: 'https://siglens.io/A',
                lastModified: FIXED_DATE,
                changeFrequency: 'daily',
                priority: 0.5,
            },
            {
                url: 'https://siglens.io/B',
                lastModified: FIXED_DATE,
                changeFrequency: 'weekly',
                priority: 0.3,
            },
        ];
        const xml = toUrlSetXml(entries);
        const aIndex = xml.indexOf('https://siglens.io/A');
        const bIndex = xml.indexOf('https://siglens.io/B');
        expect(aIndex).toBeGreaterThan(0);
        expect(bIndex).toBeGreaterThan(aIndex);
    });
});

describe('toSitemapIndexXml', () => {
    it('빈 배열은 sitemapindex 셸만 반환한다', () => {
        const xml = toSitemapIndexXml([]);
        expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
        expect(xml).toContain('<sitemapindex');
        expect(xml).toContain('</sitemapindex>');
        expect(xml).not.toContain('<sitemap>');
    });

    it('SitemapIndexEntry를 sitemapindex XML로 직렬화한다', () => {
        const entries: SitemapIndexEntry[] = [
            {
                url: 'https://siglens.io/sitemap-static.xml',
                lastModified: FIXED_DATE,
            },
            {
                url: 'https://siglens.io/sitemap-popular.xml',
                lastModified: FIXED_DATE,
            },
        ];
        const xml = toSitemapIndexXml(entries);
        expect(xml).toContain(
            '<loc>https://siglens.io/sitemap-static.xml</loc>'
        );
        expect(xml).toContain(
            '<loc>https://siglens.io/sitemap-popular.xml</loc>'
        );
        expect(xml).toContain(`<lastmod>${FIXED_DATE.toISOString()}</lastmod>`);
    });

    it('sitemap index 항목의 URL도 XML 이스케이프 처리한다', () => {
        const entries: SitemapIndexEntry[] = [
            {
                url: 'https://siglens.io/sitemap-static.xml?v=1&r=2',
                lastModified: FIXED_DATE,
            },
        ];
        const xml = toSitemapIndexXml(entries);
        expect(xml).toContain('?v=1&amp;r=2');
    });
});
