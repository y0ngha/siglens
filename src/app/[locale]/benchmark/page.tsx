import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { LOCALE_OG, resolveLocale } from '@/shared/i18n/locales';
import { brandName } from '@/shared/lib/brandName';
import { enterLocale } from '@/shared/lib/enterLocale';
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from '@/shared/lib/og';
import { localePageRobots } from '@/shared/lib/seoAlternates';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';
import { buildTwitterMetadata } from '@/shared/lib/twitterMetadata';
import { JsonLd } from '@/shared/ui/JsonLd';
import { BenchmarkPage } from '@/views/benchmark/BenchmarkPage';
import {
    buildBenchmarkDatasetJsonLd,
    getBenchmarkSeoCopy,
} from '@/views/benchmark/lib/benchmarkSeo';
import { aiOgImageUrl, aiUrl } from '@/app/ai/[locale]/aiSeo';

// 결과 데이터는 배포 때 고정된다(릴리스 JSON이 번들에 들어간다) — 배포 자체가 갱신이라
// 하루 재검증이면 충분하다. 라우트 세그먼트 설정은 리터럴이어야 한다(AP-1).
export const revalidate = 86400;

function isNoindex(robots: ReturnType<typeof localePageRobots>): boolean {
    return typeof robots === 'object' && robots.index === false;
}

/**
 * `siglens.io/benchmark` — 사본. 정본은 `ai.siglens.io/benchmark`이고 두 호스트가 같은
 * view·props로 같은 본문을 그린다(본문이 다르면 검색엔진이 canonical을 무시할 수 있다).
 *
 * **AP-4 예외 — 메인 sitemap에 넣지 않는다.** 정본 URL이 ai 호스트 sitemap(`proxy.ts`의
 * `aiSitemapXml`, `AI_INDEXABLE_PATHS`)에 실리므로, 메인 sitemap에 사본을 또 싣으면 같은
 * 문서를 두 호스트가 경쟁해 광고하게 된다. 발견 경로는 푸터 링크와 about 요약이다.
 *
 * 메타데이터는 `alternates`에 canonical만 둔다(hreflang 없음) — 사본의 언어 군집은
 * 정본 쪽이 선언한다. `og:url`·OG 이미지·Dataset `@id`·`url`도 정본과 같다 — 어느 호스트
 * 링크를 공유해도 같은 카드가 뜬다. 색인 게이트가 닫힌
 * 로케일(`localePageRobots`가 noindex)은 canonical을 `null`로 둔다 — noindex와 다른 호스트
 * canonical을 섞으면 신호가 충돌한다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const release = getPublishedBenchmarkRelease();
    if (release === null) notFound();
    const locale = resolveLocale((await params).locale);
    const copy = await getBenchmarkSeoCopy(locale, release);
    const url = aiUrl(locale, '/benchmark');
    const robots = localePageRobots(locale);
    const image = aiOgImageUrl(locale);
    const canonical = isNoindex(robots) ? null : url;
    return {
        title: { absolute: copy.title },
        description: copy.description,
        robots,
        alternates: { canonical },
        openGraph: {
            type: 'website',
            siteName: brandName(locale),
            title: copy.title,
            description: copy.description,
            url,
            locale: LOCALE_OG[locale],
            images: [
                {
                    url: image,
                    width: OG_IMAGE_WIDTH,
                    height: OG_IMAGE_HEIGHT,
                    alt: copy.ogLabel,
                },
            ],
        },
        twitter: buildTwitterMetadata({
            title: copy.title,
            description: copy.description,
            images: [image],
        }),
    };
}

export default async function BenchmarkRoute({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}) {
    const release = getPublishedBenchmarkRelease();
    if (release === null) notFound();
    const locale = enterLocale((await params).locale);
    const copy = await getBenchmarkSeoCopy(locale, release);
    return (
        <>
            <JsonLd
                data={buildBenchmarkDatasetJsonLd({
                    release,
                    copy,
                    canonicalUrl: aiUrl(locale, '/benchmark'),
                    siteUrl: SITE_URL,
                    aiSiteUrl: AI_SITE_URL,
                    organizationId: ORGANIZATION_JSON_LD_ID,
                })}
            />
            <BenchmarkPage
                release={release}
                locale={locale}
                siteUrl={SITE_URL}
                aiSiteUrl={AI_SITE_URL}
            />
        </>
    );
}
