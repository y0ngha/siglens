import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { loadSymbolNewsList } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { hasOverallProse } from '@/entities/seo-snapshot/lib/overallContent';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { SymbolRouteParams } from '@/shared/config/market';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import {
    ALWAYS_NOINDEX_TAB_ROBOTS,
    resolveSymbolOverallSeoContent,
} from '@/shared/lib/seo';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { OverallSnapshotProse } from '@/views/symbol/snapshot/renderers/OverallSnapshotProse';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { OverallContent } from '@/widgets/overall/OverallContent';

import { overallServerFallback } from './_components/overallServerFallback';
import { buildOverallHeading } from './_lib/overallHeading';
import { loadOverallPeek } from './_lib/overallPeek';

/** ISR 상한. AI 분석은 느리게 변하고 클라가 마운트 시 재요청한다. */
export const revalidate = 43200; // 12h

/**
 * 빈 배열 = 빌드 시 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand ISR. 없으면 동적 세그먼트가
 * 매 요청 동적 렌더돼 `revalidate`가 무력화된다.
 */
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: SymbolTabParams;
}

/**
 * 종합 탭 메타데이터 — **항상 noindex**. 이 탭의 산문은 프리웜되지 않아, "산문 또는 엿본 캐시가 있으면
 * 색인" 같은 조건부 게이트는 사용자 방문이 캐시를 채웠는지에 따라 색인 여부를 날마다 뒤집는다. 종합
 * 결론은 다른 탭의 요약이라 같은 검색어를 두고 차트 페이지와 경쟁하기도 한다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const {
        locale,
        ticker: upper,
        tSeo,
        assetInfo,
        degraded,
    } = await enterSymbolTabMetadata(params);
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'overall',
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolOverallSeoContent(upper, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

/**
 * 종합 탭 본문 — 스냅샷 산문(있으면) + 종합 위젯. `?tf=`는 클라가 `useUrlSearchParam`으로 읽어 CSR
 * bailout이 없고, canonical은 쿼리를 빼 페이지당 URL이 하나다.
 *
 * 스냅샷 산문의 게이트는 "행 존재"가 아니라 "렌더 가능"(`hasOverallProse` — 프로즈 컴포넌트와 같은
 * 판정)이다. 행은 있는데 content가 손상돼 산문이 null을 그리면, 행 존재로 게이트했을 때 엿보기·
 * placeholder 체인까지 건너뛰어 섹션이 통째로 빈다.
 */
export default async function OverallPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 번역과 존재 판정은 서로 독립이다(존재하지 않으면 `notFound()`로 함께 끊긴다).
    const [t, tSeo, { assetInfo }] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        requireResolvableAsset(upper),
    ]);

    // 셋 다 서로 독립이고 실패를 스스로 흡수한다(목록 `[]`, 엿보기 `null`, 스냅샷 fail-open).
    // 엿보기가 비면 위젯은 idle CTA로, 목록이 비면 클라의 `useWaitForNewsCards`가 폴링으로 회복한다.
    const [newsItems, cachedOverall, snapshots] = await Promise.all([
        loadSymbolNewsList(upper, locale),
        loadOverallPeek(upper, assetInfo.name, locale),
        // revalidate는 이 페이지 선언과 같은 값이라 색인 게이트의 읽기와 캐시를 공유한다.
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    // 종합 분석은 AI 반영 뉴스 카드가 하나라도 있을 때 의미가 있다 — SSR 시점 여부를 넘겨 클라의
    // 폴링 게이트를 즉시 통과시키거나 폴링을 시작하게 한다.
    const hasEnrichedNews = newsItems.some(item => item.sentiment !== null);
    const overallSnapshot = findSnapshotForLocale(snapshots, 'overall', locale);
    const showSnapshotProse = hasOverallProse(overallSnapshot?.content);

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const marketProfile = marketProfileOf(assetInfo);
    const descriptor = getDescriptor(marketProfile);
    const assetClass = descriptor.assetClass;
    // 옵션 문구는 탭 화이트리스트로 판정한다 — 한국 개별주식은 유동성 있는 옵션 시장이 없어 옵션 탭이
    // 없는데, assetClass(equity)만 보면 미국 종목과 같은 "옵션 시장" 문구가 나간다.
    const hasOptions = descriptor.tabs.includes('options');
    const heading = buildOverallHeading(marketProfile, displayName, t);
    const { fullTitle, description, url } = resolveSymbolOverallSeoContent(
        upper,
        assetClass,
        tSeo,
        {
            displayName,
            koreanName: assetInfo.koreanName,
            englishName: assetInfo.name,
            locale,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF·지수·모호한 종목과 crypto(schema.org 표준
    // 타입 없음)는 undefined로 생략된다.
    const aboutNode = buildAssetAboutNode(
        upper,
        pickAssetName(assetInfo, upper, locale),
        assetInfo.fmpSymbol,
        assetClass
    );
    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
        // 화면에 실제로 그려지는 스냅샷일 때만 신선도를 주장한다.
        generatedAt: showSnapshotProse ? overallSnapshot?.generatedAt : null,
    });
    const breadcrumbJsonLd = await buildSymbolTabBreadcrumbJsonLd({
        ticker: upper,
        displayName,
        tab: 'overall',
        tabUrl: url,
        tSeo,
        locale,
    });

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>{heading}</SymbolPageHeading>
                {/* 스냅샷 산문은 Suspense fallback이 아니라 영구 SSR sibling이다 — fallback 안이면
                    경계가 풀릴 때 React가 그 서브트리를 지워, JS를 실행하는 크롤러에게서 사라진다. */}
                {showSnapshotProse && (
                    <OverallSnapshotProse
                        content={overallSnapshot?.content}
                        symbol={upper}
                        displayName={displayName}
                        marketProfile={marketProfile}
                        generatedAt={overallSnapshot?.generatedAt}
                        plain={overallSnapshot?.plain}
                    />
                )}
                {/* `OverallContent`는 서버에서 렌더된다(`useUrlSearchParam`이라 CSR bailout 없음).
                    fallback은 서버 렌더가 예외적으로 suspend할 때만 HTML에 남는 안전망이다. */}
                <Suspense
                    fallback={overallServerFallback({
                        showSnapshotProse,
                        cachedOverall,
                        symbol: upper,
                        displayName,
                        marketProfile,
                        newsItems,
                    })}
                >
                    <OverallContent
                        symbol={upper}
                        companyName={assetInfo.name}
                        initialAnalysis={
                            // 캐시된 분석 산문은 한국어다. 비기본 로케일에 시드하면 스트림 요청이 아예
                            // 일어나지 않아(`staleTime: Infinity`) 번역이 붙을 기회가 없고, 재분석 말고는
                            // 한국어 분석문을 벗어날 길이 없다.
                            locale === DEFAULT_LOCALE
                                ? (cachedOverall ?? undefined)
                                : undefined
                        }
                        hasEnrichedNews={hasEnrichedNews}
                        assetClass={assetClass}
                        hasOptions={hasOptions}
                    />
                </Suspense>
                <CrossLinkCards
                    symbol={upper}
                    current="overall"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
