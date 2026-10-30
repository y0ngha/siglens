import type { RemovalSitemapEntry } from '../model';
import { escapeXml } from './xml';

const DATE_ONLY_LENGTH = 10;

/**
 * 제거 sitemap을 urlset XML로 직렬화한다. lastmod는 UTC 날짜(YYYY-MM-DD)까지만 내보내며
 * 일반 sitemap(`toUrlSetXml`)과 달리 changefreq·priority를 싣지 않는다.
 */
export function toRemovalUrlSetXml(
    entries: ReadonlyArray<RemovalSitemapEntry>
): string {
    const urls = entries
        .map(
            ({ url, lastModified }) => `
  <url>
    <loc>${escapeXml(url)}</loc>
    <lastmod>${lastModified.toISOString().slice(0, DATE_ONLY_LENGTH)}</lastmod>
  </url>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;
}
