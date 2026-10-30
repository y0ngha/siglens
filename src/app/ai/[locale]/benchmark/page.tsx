import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublishedBenchmarkRelease } from '@/entities/benchmark/release';
import { AI_SITE_URL } from '@/shared/config/aiHost';
import { RouteMessages } from '@/shared/i18n/RouteMessages';
import { resolveLocale } from '@/shared/i18n/locales';
import { enterLocale } from '@/shared/lib/enterLocale';
import { ORGANIZATION_JSON_LD_ID, SITE_URL } from '@/shared/lib/seo';
import { JsonLd } from '@/shared/ui/JsonLd';
import { BenchmarkPage } from '@/views/benchmark/BenchmarkPage';
import {
    buildBenchmarkDatasetJsonLd,
    getBenchmarkSeoCopy,
} from '@/views/benchmark/lib/benchmarkSeo';
import { aiUrl, buildAiBenchmarkMetadata } from '../_lib/aiSeo';

/**
 * 공개 전(`release`가 null)에는 404다. 메타데이터도 같은 게이트를 지나므로 not-found가
 * 렌더되기 전에 `generateMetadata`가 먼저 호출돼도 던지지 않고 `notFound()`로 끝난다.
 * ai 레이아웃이 `force-dynamic`이라 이 라우트에는 `revalidate`를 두지 않는다.
 */
export async function generateMetadata({
    params,
}: {
    readonly params: Promise<{ locale: string }>;
}): Promise<Metadata> {
    const release = getPublishedBenchmarkRelease();
    if (release === null) notFound();
    const locale = resolveLocale((await params).locale);
    return buildAiBenchmarkMetadata(
        locale,
        await getBenchmarkSeoCopy(locale, release)
    );
}

/** `ai.siglens.io/benchmark` — 정본. 본문은 `siglens.io/benchmark`와 같은 view·props다. */
export default async function AiBenchmarkRoute({
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
            {/* 탐색기(클라이언트)의 메시지만 싣는다. ai 레이아웃은 크롬 키만 내려보낸다. */}
            <RouteMessages route="benchmark" locale={locale}>
                <BenchmarkPage
                    release={release}
                    locale={locale}
                    siteUrl={SITE_URL}
                    aiSiteUrl={AI_SITE_URL}
                />
            </RouteMessages>
        </>
    );
}
