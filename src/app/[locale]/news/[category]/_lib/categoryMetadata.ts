import type { Metadata } from 'next';
import type { Locale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import type { SeoTranslator } from '@/shared/lib/seo';
import { localeCanonical, localeOpenGraph } from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';

/**
 * 카테고리 페이지의 `openGraph`·`twitter`. Next는 두 키를 부모와 병합하지 않고 교체하므로
 * 비우면 루트 레이아웃의 홈 값을 상속해 이 URL이 `og:url`로 홈을 선언한다 — 정상·빈 렌더
 * 모두 자기 제목·설명·로케일별 URL을 낸다. 이미지는 세그먼트의 `opengraph-image`가 채운다.
 */
export function categorySocialMetadata(
    locale: Locale,
    canonicalPath: string,
    title: string,
    description: string
): Pick<Metadata, 'openGraph' | 'twitter'> {
    return {
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title,
            description,
            url: localeCanonical(locale, canonicalPath),
            ...localeOpenGraph(locale),
        },
        twitter: buildTwitterMetadata({ title, description }),
    };
}

/** {@link buildEmptyCategoryMetadata} 입력. */
export interface EmptyCategoryMetadataInput {
    readonly locale: Locale;
    /** 로케일 접두사가 없는 카테고리 경로(`/news/crypto`). */
    readonly canonicalPath: string;
    /** 로케일 카탈로그에서 푼 카테고리 라벨(`CATEGORY_CONFIG.labelKey`). */
    readonly label: string;
    /** `shared.seo` 번역자 — 순수 함수라 주입받는다(서버 `generateMetadata` 전용). */
    readonly tSeo: SeoTranslator;
}

/**
 * 목록이 빈 카테고리(읽기 실패 또는 기사 없음)의 메타데이터 — 본문 degrade 메시지와 같은 판정.
 *
 * - `noindex, follow` — 헤더가 전 페이지에서 이 URL을 링크하므로 `nofollow`면 콜드 배포 직후
 *   사이트 전역에서 링크 주스가 끊긴다.
 * - self-canonical — 비우면 크롤러가 군집을 추정한다. hreflang 군집은 noindex라 싣지 않는다.
 */
export function buildEmptyCategoryMetadata({
    locale,
    canonicalPath,
    label,
    tSeo,
}: EmptyCategoryMetadataInput): Metadata {
    const title = tSeo('newsCategory.emptyTitleTemplate', { label });
    const description = tSeo('newsCategory.emptyDescriptionTemplate', {
        label,
    });
    return {
        title,
        description,
        robots: { index: false, follow: true },
        alternates: { canonical: localeCanonical(locale, canonicalPath) },
        ...categorySocialMetadata(locale, canonicalPath, title, description),
    };
}
