import { getTranslations } from 'next-intl/server';
import type {
    NotFoundOverride,
    NotFoundOverrides,
} from '@/app/_components/NotFoundView';
import { AI_PRODUCT_NAME } from '@/app/ai/[locale]/aiSeo';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
import { SITE_NAME } from '@/shared/lib/seo';
import { brandAiName, brandName } from '@/shared/lib/brandName';

const HOME_NAMESPACE = 'app.home';
const AI_NAMESPACE = 'app.ai';

const NON_DEFAULT_LOCALES = LOCALES.filter(locale => locale !== DEFAULT_LOCALE);

export function documentTitleOf(title: string, brand: string): string {
    return `${title} | ${brand}`;
}

async function siteOverride(locale: Locale): Promise<NotFoundOverride> {
    const t = await getTranslations({ locale, namespace: HOME_NAMESPACE });
    const headline = t('not-found.6cbd6d');
    return {
        documentTitle: documentTitleOf(headline, brandName(locale)),
        headline,
        body: t('not-found.03ecab').replace(/\s+/gu, ' ').trim(),
        homeLabel: t('not-found.ba81f0', { v0: brandName(locale) }),
    };
}

async function aiOverride(locale: Locale): Promise<NotFoundOverride> {
    const t = await getTranslations({ locale, namespace: AI_NAMESPACE });
    const headline = t('not-found.pageTitle');
    return {
        documentTitle: documentTitleOf(headline, brandAiName(locale)),
        headline,
        homeLabel: t('not-found.04598e'),
    };
}

/** 비기본 표면의 최소 문구. 한국어 · 메인 호스트는 서버가 전체 마크업으로 그리므로 없다. */
export async function buildOverrides(): Promise<NotFoundOverrides> {
    const [site, ai] = await Promise.all([
        Promise.all(
            NON_DEFAULT_LOCALES.map(
                async locale => [locale, await siteOverride(locale)] as const
            )
        ),
        Promise.all(
            LOCALES.map(
                async locale => [locale, await aiOverride(locale)] as const
            )
        ),
    ]);
    return {
        site: Object.fromEntries(site),
        ai: Object.fromEntries(ai),
        siteWordmark: SITE_NAME,
        aiWordmark: AI_PRODUCT_NAME,
    };
}
