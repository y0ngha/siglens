import { getTranslations } from 'next-intl/server';
import { countSkillFiles } from '@/entities/skill/api';
import { resolveLocale } from '@/shared/i18n/locales';
import {
    localeAlternatesFrom,
    localeOpenGraph,
    localePageRobots,
} from '@/shared/lib/seoAlternates';
import type { Metadata } from 'next';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    formatKoreanDate,
    METHODOLOGY_PATH,
    METHODOLOGY_UPDATED_AT,
    methodologyDescription,
    methodologyFullTitle,
    methodologyTitle,
    OPERATOR_PERSON_JSON_LD_ID,
} from '@/shared/lib/legal';
import {
    buildBreadcrumbJsonLd,
    buildWebPageJsonLd,
    ORGANIZATION_JSON_LD_ID,
    SITE_NAME,
    SITE_URL,
    localizedAbsoluteUrl,
} from '@/shared/lib/seo';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import type { SeoTranslator } from '@/shared/lib/seo';
import type { Locale } from '@/shared/i18n/locales';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { MethodologyPage } from '@/views/methodology/MethodologyPage';
import { EMPTY_SKILL_COUNTS } from '@/views/about/lib/aboutContent';
import { enterLocale } from '@/shared/lib/enterLocale';

const PAGE_URL = `${SITE_URL}${METHODOLOGY_PATH}`;

// `/about`·`/terms`와 같은 근거 — 본문이 메시지 카탈로그와 코드 상수라 배포 자체가
// 갱신이므로 하루 재검증이면 충분하다. 라우트 세그먼트 설정은 리터럴이어야 한다.
export const revalidate = 86400;

/**
 * `buildWebPageJsonLd`는 심볼 페이지들이 공유하는 범용 WebPage 노드를 만든다.
 * 여기서는 스프레드로 세 가지를 얹는다.
 *
 *  - `dateModified`: 화면 하단의 "마지막 업데이트"와 같은 `METHODOLOGY_UPDATED_AT`
 *  - `publisher`: 홈 `Organization`을 `@id`로 가리킨다
 *  - `author`: `/about`의 `Person`(`OPERATOR_PERSON_JSON_LD_ID`)을 `@id`로 가리킨다 —
 *    노드를 여기서 다시 정의하지 않는다. 같은 개체를 두 페이지가 각자 정의하면
 *    한쪽만 고쳐져 크롤러가 둘을 다른 사람으로 읽는다.
 *
 * FAQPage는 내보내지 않는다 — 이 페이지에는 질문·답변 형식의 본문이 없다.
 */
function buildMethodologyJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return {
        ...buildWebPageJsonLd({
            url: PAGE_URL,
            name: methodologyFullTitle(t),
            description: methodologyDescription(t),
            locale,
        }),
        dateModified: METHODOLOGY_UPDATED_AT.toISOString(),
        publisher: { '@id': ORGANIZATION_JSON_LD_ID },
        author: { '@id': OPERATOR_PERSON_JSON_LD_ID },
    };
}

function buildMethodologyBreadcrumbJsonLd(
    t: SeoTranslator,
    locale: Locale
): Record<string, unknown> {
    return buildBreadcrumbJsonLd(
        [{ name: methodologyTitle(t), url: PAGE_URL }],
        locale
    );
}

interface LocaleMetadataParams {
    readonly params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: LocaleMetadataParams): Promise<Metadata> {
    const { locale: rawLocale } = await params;
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });
    const ogLocale = localeOpenGraph(locale);
    return {
        // 메타 타이틀이 이미 `SIGLENS`로 시작한다 — 레이아웃 템플릿(`%s | SIGLENS`)을
        // 타면 브랜드가 두 번 붙으므로 `absolute`로 끊는다(`/about`과 같다).
        title: { absolute: methodologyFullTitle(tSeo) },
        description: methodologyDescription(tSeo),
        // 색인은 `STATIC_INDEXABLE_LOCALES`(ko)만 — 판정은 `localeRobots`가 소유한다.
        robots: localePageRobots(locale),
        alternates: await localeAlternatesFrom(params, METHODOLOGY_PATH),
        openGraph: {
            type: 'article',
            siteName: SITE_NAME,
            title: methodologyFullTitle(tSeo),
            description: methodologyDescription(tSeo),
            url: localizedAbsoluteUrl(PAGE_URL, locale),
            ...ogLocale,
            images: [
                {
                    url: '/og-image.png',
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: methodologyFullTitle(tSeo),
                },
            ],
        },
        twitter: buildTwitterMetadata({
            card: 'summary',
            title: methodologyFullTitle(tSeo),
            description: methodologyDescription(tSeo),
            images: ['/og-image.png'],
        }),
    };
}

export default async function MethodologyRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const { locale: rawLocale } = await params;
    const locale = enterLocale(rawLocale);
    const tSeo = await getTranslations({
        locale,
        namespace: 'shared.seo',
    });

    // `countSkillFiles` 오류는 graceful 처리 — 0 폴백으로 페이지를 계속 렌더한다.
    // throw가 전파되면 ISR 빈 캐시(0-byte body)가 동결된다(`/about`·홈과 같은 근거).
    const counts = await countSkillFiles().catch(e => {
        console.error('[MethodologyPage] countSkillFiles failed:', e);
        return EMPTY_SKILL_COUNTS;
    });

    return (
        <>
            <JsonLd data={buildMethodologyJsonLd(tSeo, locale)} />
            <JsonLd data={buildMethodologyBreadcrumbJsonLd(tSeo, locale)} />
            <MethodologyPage
                locale={locale}
                title={methodologyTitle(tSeo)}
                counts={counts}
                updatedAt={formatKoreanDate(METHODOLOGY_UPDATED_AT, locale)}
            />
        </>
    );
}
