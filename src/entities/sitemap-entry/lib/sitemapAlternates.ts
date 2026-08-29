import type { Locale } from '@/shared/i18n/locales';
import { buildLanguageAlternates } from '@/shared/lib/seoAlternates';

/**
 * sitemap `<url>` 하나에 붙일 다국어 대체본.
 *
 * 로케일마다 `<url>` 엔트리를 복제하지 않는다 — 종목 URL만 2,900여 개라
 * 4배가 되면 파일 상한(`SITEMAP_MAX_URLS_PER_FILE`)에도 가까워지고, lastmod
 * 신호도 4벌로 흩어진다. Google이 권장하는 형식은 엔트리 하나에 `xhtml:link`다.
 *
 * 준비된 로케일이 하나뿐이면 `undefined`를 돌려 XML을 지금과 **바이트 단위로
 * 동일**하게 유지한다. 두 번째 로케일이 준비되는 순간 전 엔트리가 한꺼번에
 * alternates를 갖는다.
 */
export function sitemapAlternates(
    path: string,
    available: readonly Locale[]
): Readonly<Record<string, string>> | undefined {
    const languages = buildLanguageAlternates(path, available);
    return Object.keys(languages).length > 0 ? languages : undefined;
}
