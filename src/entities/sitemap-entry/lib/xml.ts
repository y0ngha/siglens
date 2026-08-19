import type { SitemapEntry, SitemapIndexEntry } from '../model';

/**
 * XML 텍스트 노드에 들어갈 수 없는 문자(`& < > ' "`)를 이스케이프한다.
 * URL에 query string이나 fragment가 들어오는 경우(`?q=a&b=c` 등)를 대비.
 * sitemap.org spec 권장: entity reference로 변환.
 */
export function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** 다국어 대체본을 `xhtml:link` 요소로 직렬화한다. 없으면 빈 문자열. */
function alternateLinks(
    alternates: Readonly<Record<string, string>> | undefined
): string {
    if (!alternates) return '';
    return Object.entries(alternates)
        .map(
            ([hreflang, href]) =>
                `\n    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`
        )
        .join('');
}

/**
 * SitemapEntry[]를 sitemap.org urlset XML로 직렬화한다.
 *
 * `xhtml` 네임스페이스는 **실제로 alternates가 있을 때만** 선언한다 — 쓰지 않는
 * 네임스페이스를 항상 붙이면 기존 sitemap의 바이트만 늘고 diff가 지저분해진다.
 */
export function toUrlSetXml(entries: ReadonlyArray<SitemapEntry>): string {
    const urls = entries
        .map(
            ({ url, lastModified, changeFrequency, priority, alternates }) => `
  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
    <changefreq>${changeFrequency}</changefreq>
    <priority>${priority}</priority>${alternateLinks(alternates)}
  </url>`
        )
        .join('');

    const hasAlternates = entries.some(
        entry => entry.alternates && Object.keys(entry.alternates).length > 0
    );
    const xhtmlNs = hasAlternates
        ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
        : '';

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xhtmlNs}>${urls}\n</urlset>`;
}

/** SitemapIndexEntry[]를 sitemap.org sitemapindex XML로 직렬화한다. */
export function toSitemapIndexXml(
    entries: ReadonlyArray<SitemapIndexEntry>
): string {
    const sitemaps = entries
        .map(
            ({ url, lastModified }) => `
  <sitemap>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
  </sitemap>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemaps}\n</sitemapindex>`;
}
