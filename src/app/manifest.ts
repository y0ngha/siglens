import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';
import { buildManifest } from '@/shared/lib/buildManifest';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';

/**
 * 오리진 루트 매니페스트 — **기본 로케일(ko)** 판이다.
 *
 * 로케일별 판은 `[locale]/manifest.webmanifest/route.ts`가 낸다. 이 파일이 남아
 * 있는 이유는 `/manifest.webmanifest`를 하드코딩해 참조하는 외부 경로(구형
 * 북마크·크롤러)가 404를 받지 않게 하기 위해서다.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
    const t = await getTranslations({
        locale: DEFAULT_LOCALE,
        namespace: 'shared.seo.manifest',
    });
    return buildManifest(DEFAULT_LOCALE, t);
}
