import type {
    SitemapEntry,
    SitemapIndexEntry,
} from '@/infrastructure/sitemap/types';

/**
 * XML 텍스트 노드에 들어갈 수 없는 문자(`& < > ' "`)를 이스케이프한다.
 * URL에 query string이나 fragment가 들어오는 경우(`?q=a&b=c` 등)를 대비.
 * sitemap.org spec 권장: entity reference로 변환.
 */
function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/** SitemapEntry[]를 sitemap.org urlset XML로 직렬화한다. */
export function toUrlSetXml(entries: ReadonlyArray<SitemapEntry>): string {
    const urls = entries
        .map(
            ({ url, lastModified, changeFrequency, priority }) => `
  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified.toISOString()}</lastmod>
    <changefreq>${changeFrequency}</changefreq>
    <priority>${priority}</priority>
  </url>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;
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
