import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import {
    MobileSheetPlaceholder,
    TechnicalFactsSummary,
    buildChartPageHeading,
} from '@/views/symbol';
import { TechnicalSnapshotProse } from '@/views/symbol/snapshot/renderers/TechnicalSnapshotProse';
import { buildTechnicalFacts } from '@/views/symbol/utils/technicalFacts';
import { JsonLd } from '@/shared/ui/JsonLd';
import { FALLBACK_ANALYSIS } from '@/entities/chat-message';
import { getBlockedSymbolMetadata } from '@/app/[symbol]/symbolIndexabilityMetadata';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { DEEPSEEK_V4_FLASH_MODEL } from '@y0ngha/siglens-core';
import {
    normalizeAnalysisResponse,
    peekAnalysisStatic,
} from '@/entities/analysis';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { getDescriptor, marketProfileOf } from '@/shared/config/marketProfile';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { getQuantizedBarsStatic, getSeedBarsStatic } from '@/entities/bars';
import { countSkillFiles } from '@/entities/skill';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildSnapshotMetaDescription,
    buildSymbolWebPageJsonLd,
    resolveSymbolSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

export const revalidate = 21600; // 6h — ISR. 사용자 신선도는 클라 refetch(useBars 30s)가 보장하므로 상한만 길게

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 시 prebuild 없이, 첫 요청에 렌더+캐시 후
// revalidate 주기로 재생성하는 on-demand ISR. (cacheComponents 비활성이라 빈 배열 허용)
export async function generateStaticParams(): Promise<SymbolRouteParams[]> {
    return [];
}

interface Props {
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(ticker)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(ticker);
    // 봉 유무를 게이트에 넘기기 위해 metadata 단계에서 먼저 확정한다. 본문이
    // **같은 인자**로 부르는 `getQuantizedBarsStatic`은 `React.cache`라 요청
    // 스코프에서 접히므로 왕복이 늘지 않는다(둘 중 먼저 도는 쪽이 채우고 뒤는
    // 메모 히트 — `getSeoSnapshotsStatic`을 여기서 다시 부르는 것과 같은 패턴).
    // assetInfo가 없으면 marketProfile을 유도할 수 없으므로 조회를 건너뛴다 —
    // 그 경우는 아래 `asset-missing` 분기가 이미 noindex로 처리한다.
    const metadataBars = assetInfo
        ? await getQuantizedBarsStatic(
              ticker,
              DEFAULT_TIMEFRAME,
              marketProfileOf(assetInfo),
              assetInfo.fmpSymbol
          ).catch((e: unknown) => {
              console.error(
                  '[SymbolPage] generateMetadata getQuantizedBarsStatic failed:',
                  e
              );
              return null;
          })
        : null;
    const blockedMetadata = await getBlockedSymbolMetadata({
        symbol: ticker,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'technical',
        // 조회가 **실패**한 경우(`null`)와 조회 결과 봉이 **없는** 경우를 구분한다.
        // 인프라 장애로 null이 온 것까지 noindex로 밀면 일시 장애가 전 종목
        // 색인 해제로 번진다 — 그 경우는 `undefined`로 남겨 기존 판정을 따른다.
        //
        // 술어는 **본문과 동일하게** `buildTechnicalFacts`로 판정한다. `bars.length > 0`
        // 으로 두었더니 CTK(상장폐지, 봉 1개)가 새어 나갔다 — 그 헬퍼는 등락률 분모로
        // 직전 봉이 필요해 2개 미만이면 null을 반환하고, 그러면 본문의 지표 요약
        // 블록이 통째로 렌더되지 않아 페이지가 제목만 남은 껍데기가 된다.
        // 게이트와 본문이 서로 다른 조건을 쓰면 조용히 어긋난다(MISTAKES §2).
        hasPriceData:
            metadataBars === null
                ? undefined
                : buildTechnicalFacts(
                      metadataBars.bars,
                      metadataBars.indicators
                  ) !== null,
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return noindexSymbolMetadata(ticker);

    const displayName = buildDisplayName(assetInfo, ticker);
    const profile = marketProfileOf(assetInfo);
    const seo = resolveSymbolSeoContent(
        ticker,
        getDescriptor(profile).assetClass,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );
    const metadata = symbolMetadataFromSeo(seo);

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(ticker, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(ticker, revalidate)).find(
        s => s.tab === 'technical'
    );
    const snapshotDescription = snap
        ? buildSnapshotMetaDescription('technical', snap.content, displayName)
        : null;
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

export default async function SymbolPage({ params }: Props) {
    const { symbol } = await params;
    const ticker = symbol.toUpperCase();
    // 다른 5개 sibling 페이지(news/fundamental/options/overall/fear-greed)와 일관:
    // 잘못된 ticker 형식은 본문에서도 notFound로 즉시 차단한다 (generateMetadata 가드와 짝).
    if (!isAdmissibleSymbolShape(ticker)) notFound();
    const [{ assetInfo, degraded }, skillCounts, snapshots] = await Promise.all(
        [
            getAssetInfoResilient(ticker),
            countSkillFiles(),
            // ISR-safe (staticSymbolCache-wrapped, fail-open []) — see
            // getSeoSnapshotsStatic JSDoc. revalidateSeconds mirrors this page's
            // `export const revalidate` literal above.
            getSeoSnapshotsStatic(ticker, revalidate),
        ]
    );
    const technicalSnapshot = snapshots.find(s => s.tab === 'technical');
    // 확장된 게이트(SYMBOL_EDGE_RE)는 crypto 심볼을 수용하기 위해 이전 VALID_TICKER_RE보다
    // 넓다. 정상 조건에서 crypto 심볼은 crypto_assets DB에서 직접 해결된다(degrade 없음).
    // crypto_assets DB와 FMP가 동시에 다운된 경우에만 예외적으로 degrade 가능하며, 이는
    // 허용된 한시적 제약이다. degraded + TICKER_RE 불합격 = DB에도 crypto_assets에도 없는
    // 심볼이 FMP 없이 resolve 실패한 것 → 실재하지 않는 종목으로 취급해 notFound.
    // (MSFT 같은 정상 종목이 FMP 일시 장애 중 degrade되는 경우는 TICKER_RE를 통과하므로
    // 기존 degrade 200+noindex 동작을 유지한다.)
    if (isUnresolvableDegraded(ticker, degraded)) notFound();
    if (!assetInfo) return notFound();

    // Compute marketProfile once here so both TechnicalFactsSummary (Suspense fallback)
    // and SymbolPageClient receive the same value without recomputing on the client.
    const marketProfile = marketProfileOf(assetInfo);
    const { assetClass } = getDescriptor(marketProfile);

    // default-tf bars를 정적화로 가져온다. 실패(인프라 다운 등)는 null로 degrade해
    // 페이지가 깨지지 않도록 한다. 이 bars는 Suspense fallback의 FactLayer SSR에만 쓰이며,
    // 클라이언트 hydration 후에는 SymbolPageClient가 인터랙티브 상태로 교체된다.
    //
    // SSR seed에 forming 봉을 박으면 ISR write churn 유발 — quantize로 마지막 완료 봉까지만.
    // new Date()는 ISR-safe: quantize는 isRegularSessionOpen(session, now) boolean으로만
    // 분기하므로 정규장 안에서는 분/초 차이가 결과에 영향 없음(cache content 동일).
    // crypto(CRYPTO_SESSION)은 24/7 always-open이라 isRegularSessionOpen이 항상 true를
    // 반환 → forming 봉을 항상 제거해 ISR write churn을 방지한다.
    //
    // layout.tsx와 **같은 인자**(대문자 ticker)로 이 헬퍼를 호출해야 요청 스코프 메모가
    // 접혀 지표가 한 벌만 직렬화된다(getQuantizedBarsStatic JSDoc).
    const quantizedFactBars = await getQuantizedBarsStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        marketProfile,
        assetInfo.fmpSymbol
    ).catch((e: unknown) => {
        console.error('[SymbolPage] getQuantizedBarsStatic failed:', e);
        return null;
    });

    const displayName = buildDisplayName(assetInfo, ticker);
    const pageSeo = resolveSymbolSeoContent(ticker, assetClass, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    const { fullTitle, description, url } = pageSeo;

    // about 노드는 classifyAsset 결과가 stock일 때만 Corporation으로 채워지고,
    // ETF/Index/모호한 종목은 undefined를 반환해 spread로 자연 생략된다.
    // crypto는 schema.org 표준 타입이 없어 about 노드를 생략한다.
    const aboutNode = buildAssetAboutNode(
        ticker,
        assetInfo.koreanName ?? assetInfo.name,
        assetInfo.fmpSymbol,
        assetClass
    );
    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
    });

    // 차트 페이지는 ticker landing이므로 [Siglens, ticker] 2단계로 통일한다.
    // (sibling 페이지들은 [Siglens, ticker, 섹션명] 3단계 — buildBreadcrumbJsonLd가 Siglens를 자동 prepend.)
    const breadcrumbJsonLd = buildBreadcrumbJsonLd([{ name: ticker, url }]);

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: QUERY_STALE_TIME_MS,
            },
        },
    });

    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: 0,
    });

    // prefetchQuery(bars 재호출)는 제거 — forming 봉이 포함된 라이브 bars가
    // dehydrate seed로 박히면 ISR write churn이 발생하므로, quantize 후 동기 주입으로 대체.
    // 차트 페이지는 ISR로 캐시되므로 기본 timeframe만 seed한다.
    // ?tf= 딥링크는 클라(useTimeframeChange→useSearchParams)가 마운트 시 읽어
    // 해당 timeframe bars를 fetch한다.
    //
    // null guard: getQuantizedBarsStatic 실패 시 quantizedFactBars는 null이다. null을 setQueryData에
    // 넘기면 null "success" 값이 dehydrate 캐시에 박혀 클라 useSuspenseQuery가 data.bars를
    // null에서 읽으려다 crash하고, null은 stale 트리거가 아니므로 재fetch도 안 된다.
    // null인 경우는 seed를 생략해 클라 useBars/getBarsAction이 라이브로 fetch하게 한다.
    if (quantizedFactBars !== null) {
        // updatedAt 명시: RQ dehydrate 기본은 Date.now()라 매 ISR 재생성마다 다른 timestamp가
        // HTML에 박혀 ISR write churn 발생(2026-06-06 실측). 마지막 완료 봉의 time으로 고정해
        // 같은 봉이 계속 마지막인 한 dehydrated state 결정성 보장.
        // Bar.time은 seconds (epoch) — RQ dataUpdatedAt은 milliseconds.
        const lastBarSec = quantizedFactBars.bars.at(-1)?.time ?? 0;
        const stableUpdatedAt = lastBarSec * MS_PER_SECOND;
        // seed에는 축소판을 넣는다 — FactLayer(아래)는 전체 지표가 필요하지만 클라이언트
        // 첫 페인트는 rsi·macd·buySellVolume만 읽는다(getSeedBarsStatic JSDoc).
        // 내부적으로 같은 `getQuantizedBarsStatic` 결과를 재사용하므로 추가 fetch는 없고,
        // layout과 같은 인자로 호출해야 참조가 접혀 한 벌만 직렬화된다.
        // layout·fear-greed와 동일하게 fail-open으로 감싼다. 이 호출은 예전엔
        // 속성 읽기라 throw할 수 없었지만, 이제 `keepLastNonNull`이 배열 메서드를
        // 부르므로 런타임 shape가 `IndicatorResult`를 벗어나면 throw할 수 있다.
        const seedBars = await getSeedBarsStatic(
            ticker,
            DEFAULT_TIMEFRAME,
            marketProfile,
            assetInfo.fmpSymbol
        ).catch((e: unknown) => {
            console.error('[SymbolPage] getSeedBarsStatic failed:', e);
            return null;
        });
        if (seedBars !== null) {
            queryClient.setQueryData(
                QUERY_KEYS.bars(symbol, DEFAULT_TIMEFRAME, assetInfo.fmpSymbol),
                seedBars,
                { updatedAt: stableUpdatedAt }
            );
        }
    }

    // peek은 읽기 전용 — enqueue/생성 없음. MISS·corrupt·read 실패는 모두 MISS로
    // degrade해 FALLBACK_ANALYSIS로 폴백한다(렌더를 절대 깨지 않음). read 실패는
    // 삼키지 않고 로깅한 뒤 degrade한다.
    //
    // modelId: 익명/SSR 기본 방문자가 캐시를 쓰는 키와 정렬한다. SymbolModelContext의
    // DEFAULT_MODEL이 DEEPSEEK_V4_FLASH_MODEL이고, useAnalysis가 그 값을
    // SSE 라우트에 그대로 전달하므로 writer는 DeepSeek flash 모델 키로 캐시한다.
    // peek도 동일 모델을 넘겨야 HIT한다.
    const cachedAnalysis = await peekAnalysisStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        assetInfo.fmpSymbol,
        DEEPSEEK_V4_FLASH_MODEL
    ).catch((error: unknown) => {
        console.error('[SymbolPage] peekAnalysisStatic failed:', error);
        return null;
    });
    const initialAnalysis = normalizeAnalysisResponse(
        cachedAnalysis?.result ?? FALLBACK_ANALYSIS
    );

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {/* main 랜드마크: 다른 5개 sibling 페이지는 본문에 <main>이 있는데
                차트 페이지만 빠져 있어 의미론적 일관성이 깨졌었다. SymbolPageClient
                outer div는 flex-1로 viewport를 채우는 구조라 그 위 한 단을 main으로
                감싸 sr-only 보조 설명과 chart 본문을 하나의 랜드마크로 묶는다.
                가시 h1은 jail 제약상 SymbolPageClient의 timeframe bar 안에 둔다. */}
            {/* 차트 페이지는 CrossLinkCards를 본문에 두지 않는다 — cross-link 역할은
                layout header의 SymbolTabs가 충분히 수행한다 (탭으로 sibling 페이지
                전환 가능; anchor 기반이라 crawler도 follow 가능). TechnicalSnapshotProse는
                아래에서 별도 처리한다 (overflow-y-auto 참고). */}
            {/* audit fix FIX 1: SymbolLayout의 sticky-footer jail(SymbolLayoutClient.tsx)은
                차트 라우트에서 definite height + overflow-hidden으로 고정된다 — AI 분석
                패널이 길어져도 차트 행이 늘어나지 않게 하는 회귀 가드(SymbolLayoutClient
                .test.tsx)라 그 계약은 건드리지 않는다. 대신 이 <main> 자체가
                overflow-y-auto를 갖는 스크롤 컨테이너가 된다: 아래 wrapper div는
                `h-full shrink-0`으로 잡아 main의 전체 높이를 항상 그대로 차지하므로
                (basis 100%, shrink 금지) chart+AI 영역은 TechnicalSnapshotProse의
                존재 여부와 무관하게 절대 압축되지 않는다. 프로즈는 그 wrapper 뒤에
                오는 sibling이라 총 콘텐츠 높이가 main의 고정 높이를 넘으면(즉, 프로즈가
                실제로 존재하면) main 자신이 내부 스크롤로 노출한다 — 이전처럼
                overflow-hidden에 잘려 사라지지 않는다. h1(SymbolPageClient 또는
                fallback 안)이 프로즈보다 DOM에서 먼저 오므로 heading 위계(WCAG 1.3.1)도
                함께 해결된다. */}
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <section className="sr-only">
                    {/* 차트 h1은 SymbolPageClient(이 section보다 DOM 뒤)에 있어,
                        여기에 heading을 두면 h1보다 먼저 나와 위계가 역전된다
                        (WCAG 1.3.1). 보조 설명은 heading 없이 p로만 노출한다. */}
                    <p>{displayName} 차트 분석 개요</p>
                    <p>
                        {displayName}의 가격 흐름과 기술적 지표 요약을 확인할 수
                        있는 차트 페이지입니다.
                    </p>
                </section>
                {/* h-full + shrink-0: main의 전체 높이를 basis로 고정하고 shrink를
                    금지해, 뒤따르는 TechnicalSnapshotProse가 있어도 이 chart+AI
                    영역은 절대 압축되지 않는다(위 audit fix FIX 1 주석 참고). */}
                <div className="flex h-full shrink-0 flex-col">
                    <HydrationBoundary state={dehydrate(queryClient)}>
                        {/* fallback은 두 역할을 겸한다:
                            1. CLS 방지 — 차트 영역(flex-1)을 미리 차지해 useSearchParams
                               CSR-bailout 서브트리가 hydration 전 비어 보이는 flash를 막는다.
                            2. FactLayer SSR — bars가 있으면 TechnicalFactsSummary를 fallback으로
                               렌더해 크롤러(JS 미실행)가 기술적 지표 요약 텍스트를 SSR HTML로
                               받는다. 사용자는 hydration 후 인터랙티브 SymbolPageClient로 교체된다. */}
                        <Suspense
                            fallback={
                                <>
                                    {/* SSR 크롤용 h1: 가시 h1은 SymbolPageClient(useSearchParams
                                        CSR-bailout)에 있어 SSR HTML에 박히지 않는다. hydration 후
                                        그 가시 h1으로 교체되는 이 fallback에 동일 텍스트의 sr-only
                                        h1을 둬, JS 미실행 크롤러(Naver Yeti 등)가 메인 페이지 h1을
                                        받게 한다(나머지 5라우트의 SymbolPageHeading h1과 정합). fallback이
                                        hydration 시 교체되므로 가시 클라 h1과 동시 존재하지 않아 h1 중복은
                                        없고, 텍스트가 동일해 cloaking도 아니다. */}
                                    <h1 className="sr-only">
                                        {buildChartPageHeading(displayName)}
                                    </h1>
                                    {quantizedFactBars &&
                                    quantizedFactBars.bars.length > 0 ? (
                                        <TechnicalFactsSummary
                                            symbol={ticker}
                                            bars={quantizedFactBars.bars}
                                            indicators={
                                                quantizedFactBars.indicators
                                            }
                                            marketProfile={marketProfile}
                                        />
                                    ) : (
                                        <div
                                            className="flex min-h-0 flex-1 flex-col overflow-hidden bg-secondary-900"
                                            aria-hidden="true"
                                        />
                                    )}
                                </>
                            }
                        >
                            <SymbolPageClient
                                symbol={symbol}
                                companyName={assetInfo.name}
                                displayName={displayName}
                                initialAnalysis={initialAnalysis}
                                initialLockedInfoDepth={
                                    cachedAnalysis?.lockedInfoDepth ?? []
                                }
                                // 순수 additive: 캐시 seed 여부와 무관하게 클라이언트는
                                // 마운트 시 useAnalysis가 자동으로 재분석을 트리거하도록
                                // 항상 true를 유지한다(봇은 enqueue가 skip되어 생성 안 됨).
                                initialAnalysisFailed={true}
                                indicatorCount={skillCounts.indicators}
                                skillCount={
                                    skillCounts.patterns +
                                    skillCounts.strategies
                                }
                                marketProfile={marketProfile}
                            />
                        </Suspense>
                    </HydrationBoundary>
                </div>
                {/* 모바일 바텀시트 SSR 껍데기 — 바로 아래 TechnicalSnapshotProse와 같은
                    이유로 PERSISTENT server sibling이다. Suspense fallback에 두면 boundary가
                    resolve되는 순간(하이드레이션 ≈4.1초) React가 이 서브트리를 파괴하는데,
                    실제 vaul 시트는 그보다 늦은 ≈4.9초에 마운트되므로 그 사이 화면 하단이
                    다시 비어버린다. 껍데기는 실제 시트가 DOM에 들어오면 globals.css의
                    `body:has([data-vaul-drawer])` 규칙으로 CSS만 사라진다. 실측 타임라인은
                    MobileSheetPlaceholder의 JSDoc 참고. */}
                <MobileSheetPlaceholder />
                {/* AI 스냅샷 프로즈는 Suspense fallback이 아니라 PERSISTENT server
                    sibling으로 마운트한다(audit fix — spec §7의 "SSR-only" 의도와
                    달리 Suspense fallback 안에 두면 React가 boundary resolve 시
                    클라이언트에서 그 서브트리를 DESTROY한다: Next.js 정적 HTML에는
                    fallback이 박히지만, hydration 후 JS를 실행하는 크롤러(Googlebot
                    렌더러 포함)에게는 사라진다). 나머지 5개 sibling 탭(fundamental/
                    financials/congress/options/news)과 동일하게 plain SSR sibling
                    패턴을 따른다. peekAnalysisStatic 결과(cachedAnalysis)는 SSR
                    프로즈로 렌더되지 않고 initialAnalysis로 CSR-bailout
                    클라이언트에만 seed되므로(위 SymbolPageClient) 여기엔 중복
                    위험이 없다. 스냅샷이 없으면 TechnicalSnapshotProse가 null을
                    반환해 빈 셸도 없다.
                    audit fix FIX 1: 위 chart wrapper 뒤로 옮겨 (a) h1보다 DOM에서
                    뒤에 오게 하고(heading 위계, WCAG 1.3.1), (b) chart+AI 영역의
                    flex 분배에서 완전히 제외해(wrapper가 shrink-0) 더 이상 첫 viewport
                    높이를 두고 경쟁하지 않는다. */}
                <TechnicalSnapshotProse
                    content={technicalSnapshot?.content}
                    symbol={ticker}
                    displayName={displayName}
                    marketProfile={marketProfile}
                    generatedAt={technicalSnapshot?.generatedAt}
                />
            </main>
        </>
    );
}
