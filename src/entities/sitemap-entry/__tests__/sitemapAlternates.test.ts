import { sitemapAlternates } from '../lib/sitemapAlternates';
import { toUrlSetXml } from '../lib/xml';
import { SITE_URL } from '@/shared/lib/seo';

describe('sitemapAlternates', () => {
    it('준비 로케일이 하나면 undefined — sitemap XML이 지금과 동일하게 유지된다', () => {
        expect(sitemapAlternates('/AAPL', ['ko'])).toBeUndefined();
    });

    it('준비 로케일이 여럿이면 hreflang 맵을 만든다', () => {
        expect(sitemapAlternates('/AAPL', ['ko', 'en'])).toEqual({
            ko: `${SITE_URL}/AAPL`,
            en: `${SITE_URL}/en/AAPL`,
            'x-default': `${SITE_URL}/AAPL`,
        });
    });
});

describe('toUrlSetXml — 다국어', () => {
    const base = {
        url: `${SITE_URL}/AAPL`,
        lastModified: new Date('2026-08-20T00:00:00.000Z'),
        changeFrequency: 'daily' as const,
        priority: 0.8,
    };

    /** 쓰지 않는 네임스페이스를 항상 붙이면 기존 sitemap 바이트만 늘어난다. */
    it('alternates가 없으면 xhtml 네임스페이스를 선언하지 않는다', () => {
        const xml = toUrlSetXml([base]);
        expect(xml).not.toContain('xmlns:xhtml');
        expect(xml).not.toContain('<xhtml:link');
    });

    it('alternates가 있으면 네임스페이스와 link를 함께 낸다', () => {
        const xml = toUrlSetXml([
            {
                ...base,
                alternates: sitemapAlternates('/AAPL', ['ko', 'en']),
            },
        ]);
        expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
        expect(xml).toContain(
            `<xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}/en/AAPL"/>`
        );
        expect(xml).toContain(
            `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}/AAPL"/>`
        );
    });

    /** 엔트리 복제가 아니라 엔트리 하나에 link를 붙이는 형식이어야 한다. */
    it('로케일이 늘어도 <url> 엔트리 수는 그대로다', () => {
        const xml = toUrlSetXml([
            { ...base, alternates: sitemapAlternates('/AAPL', ['ko', 'en']) },
        ]);
        expect(xml.match(/<url>/g)).toHaveLength(1);
    });
});
