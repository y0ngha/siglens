import { getTranslations } from 'next-intl/server';
import {
    getEarningsReportComparison,
    getGradeEvents,
} from '@/app/[locale]/[symbol]/news/newsData';
import { setRequestLocale } from 'next-intl/server';
import {
    DEFAULT_LOCALE,
    isLocale,
    LOCALE_HREFLANG,
    type Locale,
} from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { getNewsList } from '@/entities/news-article/api';
import { NEWS_LIST_CACHE_KEY } from '@/entities/news-article';
import { NewsFactsSummary, NEWS_ROW_SERIALIZATION_LIMIT } from '@/widgets/news';
import { NewsAiSummary } from '@/widgets/news/NewsAiSummary';
import { NewsAiSummaryErrorBoundary } from '@/widgets/news/NewsAiSummaryErrorBoundary';
import { NewsListErrorBoundary } from '@/widgets/news/NewsListErrorBoundary';
import { NewsAiSummarySkeleton } from '@/widgets/news/NewsAiSummarySkeleton';
import { AnalystActions } from '@/widgets/news/sections/AnalystActions';
import { EventCalendar } from '@/widgets/news/sections/EventCalendar';
import { NewsList } from '@/widgets/news/sections/NewsList';
import { SymbolPageHeading } from '@/views/symbol';
import {
    NewsSnapshotProse,
    hasNewsProse,
} from '@/views/symbol/snapshot/renderers/NewsSnapshotProse';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { SectionSkeleton } from '@/views/symbol/SectionSkeleton';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { resolveNewsTitle } from '@/shared/lib/news/resolveNewsTitle';
import {
    buildAssetAboutNode,
    buildDisplayName,
    pickAssetName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
// 배럴(`@/widgets/news`)이 아니라 원본에서 직접 가져온다 — `NewsList`와 이 페이지가
// 같은 모듈 인스턴스를 보게 해서, 테스트가 배럴을 목킹해도 두 값이 갈리지 않는다.
import { NEWS_LIST_PAGE_SIZE } from '@/shared/config/newsSerialization';
import { getTodayIsoDay } from '@/shared/lib/getTodayIsoDay';
import { todayKstIsoDate } from '@/shared/lib/dateKey';
import { translateFmpError } from '@/shared/api/fmp/fmpUserMessage';
import {
    buildBreadcrumbJsonLd,
    buildSnapshotMetaDescription,
    buildSymbolSeoContent,
    buildWebPageJsonLd,
    localizedAbsoluteUrl,
    resolveSymbolNewsSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
    SITE_NAME,
    SITE_URL,
} from '@/shared/lib/seo';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getDescriptor, marketProfileOf } from '@/shared/config/marketProfile';
import { HEADING_SECTION } from '@/shared/lib/typographyStyles';
import { cn } from '@/shared/lib/cn';

export const revalidate = 43200; // 12h — 신선도는 ensureNewsCardsAnalyzedAction의 on-demand revalidateTag('news:${symbol}', 'max')가 보장, 시간 기반은 상한만

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild 없이, 첫 요청에 렌더+캐시 후
// revalidate 주기로 재생성하는 on-demand ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ locale: string; symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale: rawLocale, symbol } = await params;
    const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'news',
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return noindexSymbolMetadata(upper, tSeo, locale);

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolNewsSeoContent(upper, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(upper, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(upper, revalidate, locale)).find(
        s => s.tab === 'news'
    );
    const snapshotDescription = snap
        ? buildSnapshotMetaDescription(
              'news',
              snap.content,
              displayName,
              null,
              locale
          )
        : null;
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

interface SymbolSectionProps {
    symbol: string;
}

/**
 * 뉴스 목록만 로케일을 받는다 — 본문이 DB 콘텐츠라 해석이 필요하다. 다른
 * 섹션(캘린더·애널리스트)은 로케일과 무관한 수치라 `SymbolSectionProps`를 쓴다.
 */
interface NewsListSectionProps extends SymbolSectionProps {
    locale: Locale;
}

export async function NewsListSection({
    symbol,
    locale,
}: NewsListSectionProps) {
    // ISR degrade guard: getNewsList(Postgres)가 throw하면 ISR 캐시에 0-byte 빈 결과가
    // 굳는 것을 막으려면 여기서 흡수해야 한다. [] 로 degrade → NewsList는 빈 배열로
    // 기존 empty-state UI를 렌더하고 페이지 크롬(heading/CrossLinks 등)은 유지된다.
    const items = await staticSymbolCache(
        [NEWS_LIST_CACHE_KEY, symbol, ...contentLocaleKeyPart(locale)],
        symbol,
        () => getNewsList(symbol, locale),
        [`news:${symbol}`],
        SECONDS_PER_HALF_DAY
    ).catch((e: unknown) => {
        console.error(
            '[NewsListSection] getNewsList failed, degrading to []:',
            e
        );
        return [] as Awaited<ReturnType<typeof getNewsList>>;
    });
    // 그리지 않는 행까지 RSC 페이로드로 내보내지 않는다 — NEWS_ROW_SERIALIZATION_LIMIT 주석 참고.
    return (
        <NewsList
            items={items.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)}
            symbol={symbol}
        />
    );
}

export async function EventCalendarSection({ symbol }: SymbolSectionProps) {
    const t = await getTranslations('app.symbol');
    const today = todayKstIsoDate();
    let earningsReports: Awaited<
        ReturnType<typeof getEarningsReportComparison>
    >;
    try {
        earningsReports = await staticSymbolCache(
            ['news:earnings', symbol, today],
            symbol,
            () => getEarningsReportComparison(symbol, today),
            [`news:${symbol}`],
            SECONDS_PER_HALF_DAY
        );
    } catch (error) {
        console.error(
            '[EventCalendarSection] earnings load failed, degrading:',
            error
        );
        const message =
            translateFmpError(error, await getTranslations()) ??
            t('page.3c87a9');
        return (
            <NewsDataServerAlert title={t('page.6723ea')} message={message} />
        );
    }
    return <EventCalendar earningsReports={earningsReports} />;
}

export async function AnalystActionsSection({ symbol }: SymbolSectionProps) {
    const t = await getTranslations('app.symbol');
    let events: Awaited<ReturnType<typeof getGradeEvents>>;
    try {
        events = await staticSymbolCache(
            ['news:grades', symbol],
            symbol,
            () => getGradeEvents(symbol),
            [`news:${symbol}`],
            SECONDS_PER_HALF_DAY
        );
    } catch (error) {
        console.error(
            '[AnalystActionsSection] grades load failed, degrading:',
            error
        );
        const message =
            translateFmpError(error, await getTranslations()) ??
            t('page.5c38df');
        return (
            <NewsDataServerAlert title={t('page.b2cd1a')} message={message} />
        );
    }
    // 뉴스 목록과 같은 이유로 자른다 — AAPL 실측 1,786건 중 화면에 닿는 것은 앞의 몇 개뿐이다.
    return (
        <AnalystActions
            events={events.slice(0, NEWS_ROW_SERIALIZATION_LIMIT)}
        />
    );
}

interface NewsDataServerAlertProps {
    title: string;
    message: string;
}

function NewsDataServerAlert({ title, message }: NewsDataServerAlertProps) {
    return (
        <section
            className="rounded-lg border border-ui-danger/30 bg-secondary-800 p-6"
            role="alert"
        >
            <h2 className={cn('mb-2', HEADING_SECTION)}>{title}</h2>
            <p className="text-sm text-ui-danger-text">{message}</p>
        </section>
    );
}

export default async function NewsPage({ params }: Props) {
    const { locale, symbol } = await params;
    // DB 콘텐츠(뉴스 본문) 해석에 쓸 좁혀진 로케일. URL 세그먼트는 신뢰 경계다.
    const resolved = isLocale(locale) ? locale : DEFAULT_LOCALE;
    // 정적 렌더 활성화. 이 호출이 없으면 next-intl의 서버 API가 `headers()`로
    // 폴백해 **이 라우트의 ISR이 통째로 꺼진다**(빌드 route 표에서 `●` → `ƒ`).
    // 실측으로 확인했다 — Next 16.2는 `next/root-params` 미지원이라 이 경로가 유일하다.
    setRequestLocale(locale);
    const t = await getTranslations('app.symbol');
    const tSeo = await getTranslations('shared.seo');
    const upper = symbol.toUpperCase();

    if (!isAdmissibleSymbolShape(upper)) {
        notFound();
    }

    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    // degraded + digit-first 심볼 = 두 데이터 소스가 동시 다운 중이고 resolve 불가
    // → 차트 페이지와 동일한 notFound 처리로 sibling 일관성 유지.
    if (isUnresolvableDegraded(upper, degraded)) notFound();
    if (!assetInfo) {
        notFound();
    }

    const displayName = buildDisplayName(
        assetInfo,
        upper,
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );
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
            locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목과 crypto는
    // undefined로 자연 생략된다. crypto는 schema.org 표준 타입이 없어 about 노드 자체를 두지 않는다.
    const aboutNode = buildAssetAboutNode(
        upper,
        pickAssetName(
            assetInfo,
            upper,
            isLocale(locale) ? locale : DEFAULT_LOCALE
        ),
        assetInfo.fmpSymbol,
        assetClass
    );
    const jsonLd = buildWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale: isLocale(locale) ? locale : DEFAULT_LOCALE,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            { name: t('page.2141f2'), url },
        ],
        isLocale(locale) ? locale : DEFAULT_LOCALE
    );

    // datePublished는 의도적으로 생략한다 — ticker별 최초 뉴스 ingestion 시각
    // fetch 없이는 정확한 datePublished를 알 수 없어 SITE_BUILD_DATE를 쓰면 모든
    // ticker가 동일 시점으로 표기되는 오류 신호가 된다. Article schema에서
    // datePublished는 옵션이라 생략 가능. dateModified는 getTodayIsoDay()로
    // 일 단위 양자화 (rationale은 helper JSDoc 참고).
    const todayIsoDay = getTodayIsoDay();
    // headline/description은 자산 유형별로 분기한다 — 크립토 페이지에 주식 특유의
    // "어닝·실적·애널리스트" 문구가 등장하면 실제로 없는 콘텐츠를 약속하는 허위 신호가 된다.
    const aiArticleJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: isEquity
            ? tSeo('faq.newsArticleHeadlineEquity', { v0: displayName })
            : tSeo('faq.newsArticleHeadlineCrypto', { v0: displayName }),
        description: t(
            isEquity
                ? 'page.newsArticleDescEquity'
                : 'page.newsArticleDescCrypto',
            { v0: displayName }
        ),
        inLanguage: LOCALE_HREFLANG[isLocale(locale) ? locale : DEFAULT_LOCALE],
        dateModified: todayIsoDay,
        // `@id`는 `buildWebPageJsonLd`가 로케일 접두사를 붙인 값과 **같아야**
        // 한다 — 로케일화 이후 이 back-reference만 기본 로케일 URL을 가리켜
        // 같은 문서 안에 존재하지 않는 노드를 참조하고 있었다.
        isPartOf: {
            '@type': 'WebPage',
            '@id': `${localizedAbsoluteUrl(url, isLocale(locale) ? locale : DEFAULT_LOCALE)}#webpage`,
        },
        // Article schema는 image를 명시할 때 Rich Results 자격이 강해진다.
        // 정적 og-image.png를 사용해 hashless permanent URL을 보장 — Next.js의
        // file-based opengraph-image route는 빌드 시 `?<hash>` cache-buster를
        // URL에 부여하기 때문에, schema에서 그 URL을 hardcode하면 빌드마다
        // schema image와 OG meta가 불일치하는 회귀가 발생한다. 정적 자원은
        // 영구 URL이라 schema image 신뢰도 측면에서 더 유리.
        image: [`${SITE_URL}/og-image.png`],
        author: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
        },
        publisher: {
            '@type': 'Organization',
            name: SITE_NAME,
            url: SITE_URL,
            logo: {
                '@type': 'ImageObject',
                url: `${SITE_URL}/icon512.png`,
            },
        },
    };

    // ISR degrade guard: getNewsList(Postgres)가 throw하면 ISR 캐시에 0-byte 빈 결과가
    // 굳는 것을 막으려면 여기서 흡수해야 한다. [] 로 degrade → newsListJsonLd가 null이
    // 되고 페이지 크롬(heading/AI summary/CrossLinks 등)은 유지된다.
    //
    // Promise.all로 병렬화 — snapshots read는 서로 독립이라 직렬 await할 이유가 없다.
    const [newsItems, snapshots] = await Promise.all([
        staticSymbolCache(
            [NEWS_LIST_CACHE_KEY, upper, ...contentLocaleKeyPart(resolved)],
            upper,
            () => getNewsList(upper, resolved),
            [`news:${upper}`],
            SECONDS_PER_HALF_DAY
        ).catch((e: unknown) => {
            console.error('[NewsPage] getNewsList failed, degrading to []:', e);
            return [] as Awaited<ReturnType<typeof getNewsList>>;
        }),
        // ISR-safe (staticSymbolCache-wrapped, fail-open []) — see
        // getSeoSnapshotsStatic JSDoc. revalidateSeconds mirrors this page's
        // `export const revalidate` literal above.
        getSeoSnapshotsStatic(upper, revalidate, resolved),
    ]);
    const newsSnapshot = snapshots.find(s => s.tab === 'news');
    // audit fix FIX 2: XOR 게이트 — 스냅샷 프로즈가 렌더 가능하면(hasNewsProse)
    // 그것만 보여준다. 클라이언트 AI 위젯은 계속 마운트하되 `hideView`로 UI만 끈다 —
    // 위젯을 아예 렌더하지 않으면 `usePublishSymbolChat`이 돌지 않아 챗봇의 분석
    // 컨텍스트가 비어 입력이 잠긴다(스냅샷이 있을수록 챗이 막히는 역전). 두
    // 소스가 동일 필드(currentDriverKo/keyEventsKo/upcomingEventsKo)를 같은
    // 순서로 중복 렌더하던 문제(같은 결론을 사용자에게 두 번, 스크린리더에 두
    // 번, 중복 콘텐츠 SEO 리스크)를 해소한다. NewsFactsSummary(결정론적 DB
    // 목록 사실)는 이 게이트 대상이 아니다 — 계속 공존한다.
    // `OverallSnapshotProse.hasOverallProse` 패턴과 동일 — narrowNewsContent를
    // 재사용해 프로즈 컴포넌트와 동일 판단.
    const showNewsProse = hasNewsProse(newsSnapshot?.content);
    // At least one AI-enriched card means aggregate analysis can start immediately.
    const hasEnrichedNews = newsItems.some(item => item.sentiment !== null);

    const newsListJsonLd =
        newsItems.length > 0
            ? {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  name: tSeo('faq.newsListName', { v0: displayName }),
                  // 초기 DOM에 실제로 그려지는 카드 수와 같은 상수로 자른다.
                  // "더보기"로 늘어난 카드는 클라이언트 상태에만 있으므로 구글은
                  // 보지 못한다 — 상한이 렌더 수보다 크면 마크업이 페이지에 없는
                  // 항목을 주장하게 된다(상수 근거는 `newsSerialization.ts`).
                  itemListElement: newsItems
                      .slice(0, NEWS_LIST_PAGE_SIZE)
                      .map((item, idx) => ({
                          '@type': 'ListItem',
                          position: idx + 1,
                          item: {
                              '@type': 'NewsArticle',
                              headline: resolveNewsTitle(
                                  item,
                                  isLocale(locale) ? locale : DEFAULT_LOCALE
                              ),
                              url: item.url,
                              datePublished: item.publishedAt,
                          },
                      })),
              }
            : null;

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={aiArticleJsonLd} />
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
                {/* NewsAiSummary (below) is a client component that fetches its
                    aggregate analysis via a client-side hook — during ISR
                    generation it bakes its loading skeleton into the static HTML
                    (no crawlable AI text). This adds the pre-warmed SEO snapshot
                    prose as a plain SSR sibling, complementary to the
                    deterministic NewsFactsSummary above (list-based facts) — both
                    coexist. Renders null when no snapshot exists (spec
                    2026-07-24 Task 7b). */}
                <NewsSnapshotProse
                    symbol={upper}
                    content={newsSnapshot?.content}
                    displayName={displayName}
                    marketProfile={marketProfile}
                    generatedAt={newsSnapshot?.generatedAt}
                    plain={newsSnapshot?.plain}
                />
                <section className="sr-only">
                    <h2>{t('page.2659c6', { v0: displayName })}</h2>
                    <p>
                        {t(
                            isEquity
                                ? 'page.newsSrOnlyEquity'
                                : 'page.newsSrOnlyCrypto',
                            { v0: displayName }
                        )}
                    </p>
                </section>
                {/* audit fix FIX 2: XOR — NewsAiSummary (client widget) and
                    NewsSnapshotProse (SSR prose, above) both render the same AI
                    conclusion (currentDriverKo/keyEventsKo/upcomingEventsKo).
                    Showing both duplicated the text for sighted users and
                    screen readers and doubled as a duplicate-content SEO risk.
                    When the snapshot is renderable, the widget renders nothing (`hideView`)
                    but stays mounted so chat context keeps publishing; it stays
                    the fallback for when no snapshot exists — NewsAiSummary is
                    a client component that fetches its aggregate analysis via a
                    client-side hook, so during ISR generation it bakes its
                    loading skeleton into the static HTML (no crawlable AI text)
                    until it hydrates. NewsFactsSummary above is unaffected —
                    it's deterministic DB-list facts, not an AI conclusion. */}
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
                 * `NewsList`도 `NewsAiSummary`처럼 지속 폴링 오류를 다시
                 * 던진다. 바운더리가 없으면 그 throw가 `[symbol]/error.tsx`까지
                 * 올라가 헤더·탭 레일·관련 종목까지 **심볼 라우트 전체**를
                 * 내린다(감사 실측: 본문 1,079 → 582자).
                 */}
                <NewsListErrorBoundary>
                    <Suspense fallback={<SectionSkeleton />}>
                        <NewsListSection symbol={upper} locale={resolved} />
                    </Suspense>
                </NewsListErrorBoundary>

                {isEquity && (
                    <Suspense fallback={<SectionSkeleton />}>
                        <EventCalendarSection symbol={upper} />
                    </Suspense>
                )}

                {isEquity && (
                    <Suspense fallback={<SectionSkeleton />}>
                        <AnalystActionsSection symbol={upper} />
                    </Suspense>
                )}

                <CrossLinkCards
                    symbol={upper}
                    current="news"
                    marketProfile={marketProfile}
                />
            </main>
        </>
    );
}
