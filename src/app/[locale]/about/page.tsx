import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localeRobots,
} from '@/shared/lib/seoAlternates';
import type { Metadata } from 'next';
import { LegalPageShell } from '@/widgets/legal/LegalPageShell';
import { UntranslatedNotice } from '@/widgets/legal/UntranslatedNotice';
import { PolicyMarkdownBody } from '@/widgets/legal/PolicyMarkdownBody';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    ABOUT_PATH,
    ABOUT_UPDATED_AT,
    aboutDescription,
    aboutFullTitle,
    aboutTitle,
    formatKoreanDate,
    SITE_OPERATOR,
} from '@/shared/lib/legal';
import { extractToc } from '@/shared/lib/legal-toc';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    SITE_NAME,
    SITE_URL,
    localizedAbsoluteUrl,
} from '@/shared/lib/seo';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { resolveAboutContent } from './content';

const PAGE_URL = `${SITE_URL}${ABOUT_PATH}`;

// terms/privacy와 동일한 근거(§terms/page.tsx `revalidate` 주석) — 본문이
// 코드 상수라 배포 자체가 갱신이므로, 하루 재검증이면 충분하다.
export const revalidate = 86400;

/**
 * `buildWebPageJsonLd`는 8개 심볼 페이지가 공유하는 범용 WebPage 노드를
 * 만든다. 여기서는 스프레드 뒤에 `@type`을 `AboutPage`로 덮어써 좁히고,
 * `mainEntity`로 홈 `Organization`(`${SITE_URL}#organization`)을 가리킨다 —
 * 이 문서가 그 조직에 대한 소개 문서임을 명시한다.
 */
function buildAboutJsonLd(t: SeoTranslator, locale: Locale) {
    return {
        ...buildWebPageJsonLd({
            url: PAGE_URL,
            name: aboutFullTitle(t),
            description: aboutDescription(t),
            locale,
        }),
        '@type': 'AboutPage',
        mainEntity: { '@id': `${SITE_URL}#organization` },
    };
}

/**
 * `@id`가 홈 `Organization.founder`(`app/[locale]/page.tsx`)와 문자 그대로
 * 같아야 두 노드를 같은 개체로 크롤러가 묶는다 — 여기서 하나라도 오타가 나면
 * `founder` 링크가 죽은 참조가 된다.
 */
function buildAboutPersonJsonLd() {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        '@id': `${SITE_URL}${ABOUT_PATH}#person`,
        name: SITE_OPERATOR.name,
        email: `mailto:${SITE_OPERATOR.email}`,
        url: `${SITE_URL}${ABOUT_PATH}`,
        sameAs: [SITE_OPERATOR.githubUrl],
        affiliation: { '@id': `${SITE_URL}#organization` },
    };
}

function buildAboutBreadcrumbJsonLd(t: SeoTranslator, locale: Locale) {
    return buildBreadcrumbJsonLd(
        [{ name: aboutTitle(t), url: PAGE_URL }],
        locale
    );
}

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale } = await params;
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale: resolved,
        namespace: 'shared.seo',
    });
    const ogLocale = localeOpenGraph(resolved);
    return {
        title: aboutTitle(tSeo),
        description: aboutDescription(tSeo),
        robots: localeRobots(resolved),
        alternates: await localeAlternatesFrom(params, ABOUT_PATH),
        openGraph: {
            type: 'article',
            siteName: SITE_NAME,
            title: aboutFullTitle(tSeo),
            description: aboutDescription(tSeo),
            url: localizedAbsoluteUrl(PAGE_URL, resolved),
            ...ogLocale,
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: aboutFullTitle(tSeo),
                },
            ],
        },
        twitter: {
            card: 'summary',
            title: aboutFullTitle(tSeo),
            description: aboutDescription(tSeo),
            images: ['/og-image.png'],
        },
    };
}

export default async function AboutPage({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({
        locale: resolved,
        namespace: 'shared.seo',
    });
    const tLegal = await getTranslations({
        locale: resolved,
        namespace: 'shared.lib.legal',
    });

    const { body, bodyLocale, isTranslationFallback } =
        resolveAboutContent(resolved);
    const toc = extractToc(body);

    return (
        <>
            <JsonLd data={buildAboutJsonLd(tSeo, resolved)} />
            <JsonLd data={buildAboutPersonJsonLd()} />
            <JsonLd data={buildAboutBreadcrumbJsonLd(tSeo, resolved)} />
            <LegalPageShell
                breadcrumbTitle={aboutTitle(tSeo)}
                eyebrow="ABOUT"
                title={aboutTitle(tSeo)}
                intro={tLegal('aboutIntro', { v0: SITE_NAME })}
                effectiveDate={formatKoreanDate(ABOUT_UPDATED_AT, resolved)}
                toc={toc}
                topNotice={
                    isTranslationFallback ? (
                        <UntranslatedNotice
                            requested={resolved}
                            served={bodyLocale}
                        />
                    ) : undefined
                }
            >
                <PolicyMarkdownBody markdown={body} />
            </LegalPageShell>
        </>
    );
}
