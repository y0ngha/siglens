import { getTranslations } from 'next-intl/server';
import { AI_PRODUCT_NAME } from '@/app/ai/[locale]/_lib/aiSeo';
import { SITE_NAME } from '@/shared/config/brand';
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
import { brandAiName, brandName } from '@/shared/lib/brandName';
import type { NotFoundOverride, NotFoundOverrides } from './NotFoundView';

const HOME_NAMESPACE = 'app.home';
const AI_NAMESPACE = 'app.ai';

const NON_DEFAULT_LOCALES = LOCALES.filter(locale => locale !== DEFAULT_LOCALE);

/** 404 문서 제목(`<title>`) — `제목 | 브랜드`. 루트 레이아웃의 제목 템플릿을 거치지 않는 404가 직접 조립한다. */
export function documentTitleOf(title: string, brand: string): string {
    return `${title} | ${brand}`;
}

/**
 * 줄바꿈·연속 공백을 한 칸으로 접는다. 404 안내 문구는 JSX 들여쓰기째 카탈로그로 추출돼 줄바꿈을
 * 품고 있어, 메타 태그나 props에 그대로 실리면 안 된다.
 */
export function collapseWhitespace(text: string): string {
    return text.replace(/\s+/gu, ' ').trim();
}

/**
 * 메인 호스트 404 문구 한 벌. 비기본 로케일은 `NotFoundView`의 최소 문구로, 기본 로케일은 루트
 * `not-found.tsx`의 서버 마크업으로 쓰여 두 표면이 같은 조립을 공유한다.
 */
export async function buildSiteOverride(
    locale: Locale
): Promise<NotFoundOverride> {
    const t = await getTranslations({ locale, namespace: HOME_NAMESPACE });
    const headline = t('not-found.6cbd6d');
    return {
        documentTitle: documentTitleOf(headline, brandName(locale)),
        headline,
        body: collapseWhitespace(t('not-found.03ecab')),
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
                async locale =>
                    [locale, await buildSiteOverride(locale)] as const
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
