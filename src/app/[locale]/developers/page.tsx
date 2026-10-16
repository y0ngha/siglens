import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isPublicApiEnabled } from '@/shared/api/publicApiEnabled';
import { getTranslations } from 'next-intl/server';
import { publicApiToolSpecs } from '@/app/api/v1/publicApiTools';
import { buildApiToolReferences } from '@/entities/siglens-api-key/lib/buildApiToolReferences';
import {
    DEVELOPERS_PATH,
    DEVELOPERS_UPDATED_AT,
} from '@/shared/config/publicApi';
import { resolveLocale, type Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import { formatKoreanDate } from '@/shared/lib/legal';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    ORGANIZATION_JSON_LD_ID,
    SITE_URL,
    localizedAbsoluteUrl,
    type SeoTranslator,
} from '@/shared/lib/seo';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localePageRobots,
} from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { JsonLd } from '@/shared/ui/JsonLd';
import { DevelopersPage } from '@/views/developers/DevelopersPage';

const PAGE_URL = `${SITE_URL}${DEVELOPERS_PATH}`;

// `/about`·`/methodology`와 같은 근거 — 본문이 메시지 카탈로그와 코드 상수(한도·오류 코드·도구 스펙)라
// 배포 자체가 갱신이므로 하루 재검증이면 충분하다. 라우트 세그먼트 설정은 리터럴이어야 한다.
// 이 페이지는 DB·Redis·외부 API를 읽지 않아 E2E처럼 데이터 저장소가 없는 환경에서도 렌더된다.
export const revalidate = 86400;

/**
 * `<title>`·OG 제목. `/methodology`와 같은 이유로 레이아웃 템플릿(`%s | 시그렌즈`)을 타지 않는다 —
 * 카탈로그 문구가 이미 브랜드로 시작하므로 `absolute`로 끊는다.
 */
function developersFullTitle(t: SeoTranslator): string {
    return t('developers.metaTitle');
}

/**
 * `WebPage` 하나다. 이 페이지에는 질문·답변 형식의 본문이 없어 FAQPage를 내지 않고, API 문서라는 이유로
 * `TechArticle`·`APIReference` 같은 더 좁은 타입을 얹지도 않는다 — 본문이 지키지 못하는 약속이 되고
 * 이미 `WebPage`가 덮는다. `dateModified`는 화면 하단의 "마지막 업데이트"와 같은 상수다.
 */
function buildDevelopersJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return {
        ...buildWebPageJsonLd({
            url: PAGE_URL,
            name: developersFullTitle(t),
            description: t('developers.description'),
            locale,
        }),
        dateModified: DEVELOPERS_UPDATED_AT.toISOString(),
        publisher: { '@id': ORGANIZATION_JSON_LD_ID },
    };
}

export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    // 공개 API 출시 전에는 페이지가 없다 — 메타데이터 단계에서도 404로 끊어 noindex 404가 나가게 한다.
    if (!isPublicApiEnabled()) notFound();
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const title = developersFullTitle(tSeo);
    const description = tSeo('developers.description');
    return {
        title: { absolute: title },
        description,
        // 색인은 `STATIC_INDEXABLE_LOCALES`(ko)만 — 판정은 `localeRobots`가 소유한다.
        robots: localePageRobots(locale),
        alternates: await localeAlternatesFrom(params, DEVELOPERS_PATH),
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title,
            description,
            url: localizedAbsoluteUrl(PAGE_URL, locale),
            ...localeOpenGraph(locale),
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: title,
                },
            ],
        },
        twitter: buildTwitterMetadata({
            card: 'summary',
            title,
            description,
            images: ['/og-image.png'],
        }),
    };
}

export default async function DevelopersRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    if (!isPublicApiEnabled()) notFound();
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });

    // 도구 목록은 `/api/v1/openapi.json`·SKILL.md·`GET /tools`와 같은 소스(`publicApiToolSpecs`)다.
    // 외부 데이터가 없어 던질 일이 없다(순수 스펙 가공).
    const tools = buildApiToolReferences({
        baseUrl: SITE_URL,
        tools: publicApiToolSpecs(),
    });

    return (
        <>
            <JsonLd data={buildDevelopersJsonLd(tSeo, locale)} />
            <JsonLd
                data={buildBreadcrumbJsonLd(
                    [{ name: tSeo('developers.title'), url: PAGE_URL }],
                    locale
                )}
            />
            <DevelopersPage
                locale={locale}
                title={tSeo('developers.title')}
                baseUrl={SITE_URL}
                tools={tools}
                updatedAt={formatKoreanDate(DEVELOPERS_UPDATED_AT, locale)}
            />
        </>
    );
}
