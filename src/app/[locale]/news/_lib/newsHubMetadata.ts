import type { Metadata } from 'next';
import type { Locale } from '@/shared/i18n/locales';
import { brandName, brandTitle } from '@/shared/lib/brandName';
import {
    localeCanonical,
    localeOpenGraph,
    localePageRobots,
    type LocaleAlternatesResult,
} from '@/shared/lib/seoAlternates';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';

/**
 * `/news/opengraph-image.tsx`의 로케일 없는 경로. 하위 허브(`/news/us`)가 이 이미지를
 * 명시적으로 가리킬 때 `localeCanonical`로 로케일 접두사를 붙여 쓴다.
 */
export const NEWS_HUB_OG_IMAGE_PATH = '/news/opengraph-image';

/** {@link buildNewsHubMetadata} 입력. */
export interface NewsHubMetadataInput {
    readonly locale: Locale;
    /** 로케일 접두사가 없는 경로(`/news`, `/news/us`). */
    readonly path: string;
    /** 브랜드 없는 제목 — `<title>`은 레이아웃 템플릿이 브랜드를 붙이고, 소셜 카드는 여기서 붙인다. */
    readonly title: string;
    readonly description: string;
    readonly keywords: readonly string[];
    /** 본문과 같은 술어(`allPreviewsEmpty`). 참이면 noindex(`follow`는 유지). */
    readonly degraded: boolean;
    /**
     * 라우트가 직접 만든 alternates — 정상이면 `localeAlternatesFrom`(로케일별 자기참조 +
     * hreflang), degraded면 `selfCanonicalAlternates`(hreflang 없음). 라우트 소스에 남기는
     * 이유는 `localeCoverage` 가드가 페이지 소스에서 로케일 배선을 확인하기 때문이다.
     * canonical에 ko 절대 URL을 넣으면 `/en/…`이 ko를 가리켜 hreflang 상호참조가 깨진다.
     */
    readonly alternates: LocaleAlternatesResult;
    /**
     * 소셜 카드 이미지의 로케일 없는 경로. 자기 세그먼트에 `opengraph-image`가 없는 허브만
     * 넘긴다 — 페이지가 `openGraph`를 선언하면 상위 세그먼트의 파일 컨벤션 이미지 상속이
     * 끊기고, 빌드·렌더 어디서도 에러가 나지 않는다. 생략하면 자기 세그먼트의 파일 컨벤션이 채운다.
     */
    readonly imagePath?: string;
}

/**
 * 뉴스 허브(`/news`·`/news/us`)의 `generateMetadata` 본체 — 두 라우트가 같은 골격을 쓴다.
 *
 * 데이터 허브용 `buildHubMetadata`를 쓰지 않는 이유: 그쪽은 소셜 카드를 사이트 공용
 * `/og-image.png`로 덮는데, 뉴스 허브는 자기 OG 이미지 라우트가 있다.
 * `og:url`·이미지 URL은 로케일별이다 — 기본 로케일 URL을 주면 공유 카드가 ko 페이지·ko 이미지로 되돌아간다.
 */
export function buildNewsHubMetadata({
    locale,
    path,
    title,
    description,
    keywords,
    degraded,
    alternates,
    imagePath,
}: NewsHubMetadataInput): Metadata {
    const fullTitle = brandTitle(title, locale);
    const images =
        imagePath === undefined
            ? undefined
            : [localeCanonical(locale, imagePath)];
    return {
        title,
        description,
        keywords: [...keywords],
        alternates,
        robots: degraded
            ? { index: false, follow: true }
            : localePageRobots(locale),
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title: fullTitle,
            description,
            url: localeCanonical(locale, path),
            ...localeOpenGraph(locale),
            ...(images && { images }),
        },
        twitter: buildTwitterMetadata({
            title: fullTitle,
            description,
            images,
        }),
    };
}
