import type { RemovalSitemapEntry } from '../model';
import { escapeXml } from './xml';

const DATE_ONLY_LENGTH = 10;

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
