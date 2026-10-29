import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { buildSymbolTabBreadcrumbJsonLd } from '@/app/[locale]/[symbol]/_lib/symbolTabBreadcrumb';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from '@/app/[locale]/[symbol]/_lib/symbolTabEntry';
import { loadSymbolNewsList } from '@/app/[locale]/[symbol]/_lib/symbolNewsList';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { loadTabSnapshotMeta } from '@/app/[locale]/[symbol]/symbolSnapshotDescription';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { hasNewsProse } from '@/entities/seo-snapshot/lib/newsContent';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { SymbolRouteParams } from '@/shared/config/market';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { kstDateKey } from '@/shared/lib/etTimeUtils';
import {
    buildTitleSubject,
    resolveSymbolNewsSeoContent,
} from '@/shared/lib/seo';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { NewsSnapshotProse } from '@/views/symbol/snapshot/renderers/NewsSnapshotProse';
import { NewsAiSummary } from '@/widgets/news/NewsAiSummary';
import { NewsAiSummaryErrorBoundary } from '@/widgets/news/NewsAiSummaryErrorBoundary';
import { NewsAiSummarySkeleton } from '@/widgets/news/NewsAiSummarySkeleton';
import { NewsFactsSummary } from '@/widgets/news/NewsFactsSummary';
import { NewsListErrorBoundary } from '@/widgets/news/NewsListErrorBoundary';

import {
    AnalystActionsSection,
    EventCalendarSection,
    NewsListSection,
} from './_components/NewsSections';
import {
    buildNewsArticleJsonLd,
    buildNewsListJsonLd,
    newsArticleDates,
} from './_lib/newsJsonLd';

/**
 * ISR 상한. 신선도는 `ensureNewsCardsAnalyzedAction`의 on-demand
 * `revalidateTag('news:${symbol}', 'max')`가 보장하고, 시간 기반은 상한만 둔다.
 */
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
 * 뉴스 탭 메타데이터. 색인 판정(렌더 가능한 AI 스냅샷 산문 기준 — sitemap과 같은 `hasProseForTab`)은
 * `getBlockedSymbolMetadata`가 하고, 차단 시 canonical은 살아 있는 자기 URL(self-canonical)이다.
 * 스냅샷이 있으면 검색 결과용 description만 스냅샷 문장으로 바꾼다.
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
        tab: 'news',
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolNewsSeoContent(upper, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    const { description: snapshotDescription } = await loadTabSnapshotMeta({
        symbol: upper,
        tab: 'news',
        revalidate,
        locale,
        // 접두는 짧은 주어(`애플(AAPL)`) — 긴 표시명이 문장 예산을 먹는다.
        subject: buildTitleSubject(upper, assetInfo.koreanName),
        assetClass,
        tSeo,
    });
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

/**
 * 뉴스 탭 본문 — 제목, 뉴스 사실 요약, AI 스냅샷 산문, AI 요약 위젯, 목록·캘린더·애널리스트 섹션.
 *
 * AI 산문과 AI 위젯은 같은 결론을 그리므로 XOR이다: 스냅샷이 렌더 가능하면 산문만 보이고, 위젯은
 * `hideView`로 화면만 끈 채 마운트를 유지한다(헤더 공유 버튼의 `useRegisterShareable` 등록 때문).
 * `NewsFactsSummary`는 DB 목록의 결정적 사실이라 이 게이트와 무관하게 공존한다.
 */
export default async function NewsPage({ params }: Props) {
    const { locale, ticker: upper } = await enterSymbolTabPage(params);
    // 번역과 존재 판정은 서로 독립이다(존재하지 않으면 `notFound()`로 함께 끊긴다).
    const [t, tSeo, { assetInfo }] = await Promise.all([
        getTranslations('app.symbol'),
        getTranslations('shared.seo'),
        requireResolvableAsset(upper),
    ]);

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const marketProfile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const isEquity = assetClass === 'equity';
    const { fullTitle, description, url } = resolveSymbolNewsSeoContent(
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
    const [breadcrumbJsonLd, newsItems, snapshots] = await Promise.all([
        buildSymbolTabBreadcrumbJsonLd({
            ticker: upper,
            displayName,
            tab: 'news',
            tabUrl: url,
            tSeo,
            locale,
        }),
        loadSymbolNewsList(upper, locale),
        // revalidate는 이 페이지 선언과 같은 값이라 메타데이터·색인 게이트의 읽기와 캐시를 공유한다.
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    const newsSnapshot = findSnapshotForLocale(snapshots, 'news', locale);
    // 프로즈 컴포넌트와 같은 `narrowNewsContent` 판정이라 둘이 어긋나지 않는다.
    const showNewsProse = hasNewsProse(newsSnapshot?.content);
    // AI 반영 카드가 하나라도 있으면 종합 분석을 바로 시작할 수 있다.
    const hasEnrichedNews = newsItems.some(item => item.sentiment !== null);

    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
        // 화면에 실제로 그려지는 스냅샷일 때만 신선도를 주장한다.
        generatedAt: showNewsProse ? newsSnapshot?.generatedAt : null,
    });
    // headline/description은 자산 유형별로 갈린다 — 크립토 페이지에 "실적·애널리스트" 문구가 나오면
    // 없는 콘텐츠를 약속하는 셈이다.
    const aiArticleJsonLd = buildNewsArticleJsonLd({
        headline: isEquity
            ? tSeo('faq.newsArticleHeadlineEquity', { v0: displayName })
            : tSeo('faq.newsArticleHeadlineCrypto', { v0: displayName }),
        description: t(
            isEquity
                ? 'page.newsArticleDescEquity'
                : 'page.newsArticleDescCrypto',
            { v0: displayName }
        ),
        locale,
        pageUrl: url,
        dates: newsArticleDates(
            newsSnapshot?.generatedAt,
            newsSnapshot?.firstGeneratedAt
        ),
    });
    const newsListJsonLd = buildNewsListJsonLd(
        newsItems,
        tSeo('faq.newsListName', { v0: displayName }),
        locale
    );

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {/* Article은 화면에 보이는 AI 산문이 있을 때만 싣는다(FAQPage를 가시 FAQ에만 붙이는 것과
                같은 규칙). */}
            {showNewsProse ? <JsonLd data={aiArticleJsonLd} /> : null}
            {newsListJsonLd ? <JsonLd data={newsListJsonLd} /> : null}
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>
                    {t(
                        isEquity
                            ? 'page.newsHeadingEquity'
                            : 'page.newsHeadingCrypto',
                        { v0: displayName }
                    )}
                </SymbolPageHeading>
                <NewsFactsSummary
                    displayName={displayName}
                    assetClass={assetClass}
                    items={newsItems}
                />
                {/* 스냅샷 산문은 SSR sibling이다. 아래 AI 위젯은 클라 훅으로 데이터를 받아 ISR HTML에
                    골격만 남기므로, 크롤러가 읽는 AI 문장은 이 산문뿐이다. 스냅샷이 없으면 null. */}
                <NewsSnapshotProse
                    symbol={upper}
                    content={newsSnapshot?.content}
                    displayName={displayName}
                    marketProfile={marketProfile}
                    generatedAt={newsSnapshot?.generatedAt}
                    plain={newsSnapshot?.plain}
                />
                {/* 클라 전용 경계 — 서버 데이터를 기다리지 않는다. */}
                <NewsAiSummaryErrorBoundary>
                    <Suspense
                        fallback={
                            showNewsProse ? null : <NewsAiSummarySkeleton />
                        }
                    >
                        <NewsAiSummary
                            symbol={upper}
                            companyName={assetInfo.name}
                            hasEnrichedNews={hasEnrichedNews}
                            hideView={showNewsProse}
                        />
                    </Suspense>
                </NewsAiSummaryErrorBoundary>

                {/*
                 * `NewsList`는 지속 폴링 오류를 다시 던진다 — 바운더리가 없으면 `[symbol]/error.tsx`까지
                 * 올라가 헤더·탭 레일·관련 종목까지 심볼 라우트 전체를 내린다.
                 *
                 * 세 서버 섹션은 Suspense로 감싸지 않는다. 서버 데이터 경계는 raw HTML에 숨김 청크를
                 * 남겨 JS를 실행하지 않는 크롤러(Naver Yeti·Daumoa)에게 본문을 문서 끝으로 밀고, 경계
                 * 안쪽 `notFound()`를 200으로 새게 한다. ISR 정적 응답이라 대기는 콜드젠 한 번뿐이다.
                 */}
                <NewsListErrorBoundary>
                    <NewsListSection symbol={upper} locale={locale} />
                </NewsListErrorBoundary>

                {isEquity && (
                    <EventCalendarSection
                        symbol={upper}
                        // 요청 시각을 읽는 것 자체가 목적이다. 서버 섹션의 캐시 키로만 쓰이고 클라이언트로
                        // 하이드레이션되지 않는다 — 하이드레이션 불일치 경로가 아니다.
                        // react-doctor-disable-next-line react-doctor/rendering-hydration-mismatch-time
                        today={kstDateKey(new Date())}
                    />
                )}

                {isEquity && <AnalystActionsSection symbol={upper} />}

                <CrossLinkCards
                    symbol={upper}
                    current="news"
                    marketProfile={marketProfile}
                    indexableOnly
                />
            </main>
        </>
    );
}
