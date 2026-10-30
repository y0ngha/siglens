import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { loadDilutionHeadingBadge } from '@/app/[locale]/[symbol]/dilutionHeadingBadge';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { loadTabSnapshotMeta } from '@/app/[locale]/[symbol]/symbolSnapshotDescription';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { normalizeAnalysisResponse } from '@/entities/analysis/lib/normalizeAnalysisResponse';
import { peekAnalysisStatic } from '@/entities/analysis/server/peekAnalysisStaticCache';
import { getQuantizedBarsStatic } from '@/entities/bars/server/barsStaticCache';
import { hasFormingBar } from '@/entities/bars/lib/quantizeBars';
import { findSnapshotForLocale } from '@/entities/seo-snapshot/lib/findSnapshotForLocale';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { hasTechnicalProse } from '@/entities/seo-snapshot/lib/technicalContent';
import { countSkillFiles } from '@/entities/skill/api';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { resolveKrxTickTableForDisplay } from '@/entities/ticker/lib/resolveKrxTickTable';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { assetInfoSeedUpdatedAt } from '@/shared/config/assetInfoSeed';
import { DEFAULT_TIMEFRAME, SymbolRouteParams } from '@/shared/config/market';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { RouteMessages } from '@/shared/i18n/RouteMessages';
import {
    buildBreadcrumbJsonLd,
    buildTitleSubject,
    resolveSymbolSeoContent,
} from '@/shared/lib/seo';
import { chartSkillTotal } from '@/shared/lib/skillStats';
import { symbolMetadataFromSeo } from '@/shared/lib/symbolMetadata';
import { JsonLd } from '@/shared/ui/JsonLd';
import { MobileSheetPlaceholder } from '@/views/symbol/MobileSheetPlaceholder';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import { TechnicalFactsSummary } from '@/views/symbol/TechnicalFactsSummary';
import { TechnicalSnapshotProse } from '@/views/symbol/snapshot/renderers/TechnicalSnapshotProse';
import { symbolFactsSubject } from '@/views/symbol/utils/factsSubject';

import { hasTechnicalFacts, seedChartBars } from './_lib/chartBarsSeed';
import {
    enterSymbolTabMetadata,
    enterSymbolTabPage,
    type SymbolTabParams,
} from './_lib/symbolTabEntry';

/** ISR 상한. 사용자 신선도는 클라 refetch(`useBars` 30s)가 보장하므로 상한만 길게 둔다. */
export const revalidate = 21600; // 6h

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
 * 차트 탭(종목 랜딩) 메타데이터. 색인 판정에 봉 유무를 넘기려고 봉을 여기서 먼저 확정한다 — 본문이
 * 같은 인자로 부르는 `getQuantizedBarsStatic`은 `React.cache`라 요청 안에서 왕복이 늘지 않는다.
 * 스냅샷이 있으면 검색 결과용 description만 스냅샷 문장(평이화 우선)으로 바꾼다.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, ticker, tSeo, assetInfo, degraded } =
        await enterSymbolTabMetadata(params);
    const metadataBars = await getQuantizedBarsStatic(
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
    });
    const blockedMetadata = await getBlockedSymbolMetadata({
        locale,
        symbol: ticker,
        assetInfo,
        // 봉 조회 **실패**(`null`)는 degrade다 — "degraded → 이 탭의 렌더 가능한 스냅샷이 있을 때만 색인"
        // 규칙을 그대로 탄다. 장애 중 껍데기가 색인되지 않고, 회복되면 다음 재생성에서 원래 판정으로
        // 돌아간다(큐레이션 종목은 런타임 degrade로 revalidate가 짧아져 노출 창이 수 분이다).
        degraded: degraded || metadataBars === null,
        revalidateSeconds: revalidate,
        tab: 'technical',
        // 조회 실패와 봉이 **없는** 경우를 구분한다. 실패는 위 `degraded`가 받으므로 `undefined`다 — 봉이
        // 정말 없는 것("no-price-data", 스냅샷이 있어도 색인 불가)과 섞지 않는다. 판정은 본문의 크롤용
        // 사실 요약과 같은 `hasTechnicalFacts`다.
        hasPriceData:
            metadataBars === null ? undefined : hasTechnicalFacts(metadataBars),
    });
    if (blockedMetadata) return blockedMetadata;

    const displayName = buildDisplayName(assetInfo, ticker, locale);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolSeoContent(ticker, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    const { description: snapshotDescription } = await loadTabSnapshotMeta({
        symbol: ticker,
        tab: 'technical',
        revalidate,
        locale,
        // 접두는 짧은 주어(`애플(AAPL)`) — 긴 표시명이 문장 예산을 먹는다.
        subject: buildTitleSubject(ticker, assetInfo.koreanName),
        assetClass,
        tSeo,
        preferPlain: true,
    });
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

/**
 * 차트 탭 본문 — 차트·AI 패널(`SymbolPageClient`, 서버에서도 렌더)과 크롤용 서버 사본들(기술적 사실
 * 요약·모바일 시트 껍데기·스냅샷 산문).
 *
 * `SymbolPageClient`는 Suspense로 감싸지 않는다. URL `tf`를 `useUrlSearchParam`으로 읽어 CSR bailout이
 * 없으므로 차트·AI 패널·가시 h1이 SSR HTML에 바로 박힌다. 경계를 두면 스트림 타이밍에 따라 fallback h1과
 * 숨김 청크의 진짜 h1이 raw HTML에 **둘 다** 남는다(e2e `symbol-seo` "exactly one h1").
 */
export default async function SymbolPage({ params }: Props) {
    const { locale, ticker, segment } = await enterSymbolTabPage(params);
    // 번역·자산·스킬 수·스냅샷은 서로 독립이다.
    const [
        tViews,
        tSeo,
        tFallback,
        { assetInfo, degraded },
        skillCounts,
        snapshots,
    ] = await Promise.all([
        getTranslations('views.symbol'),
        getTranslations('shared.seo'),
        getTranslations('entities.analysis.fallback'),
        requireResolvableAsset(ticker),
        countSkillFiles(),
        // revalidate는 이 페이지 선언과 같은 값이라 메타데이터·색인 게이트의 읽기와 캐시를 공유한다.
        getSeoSnapshotsStatic(ticker, revalidate, locale),
    ]);
    const technicalSnapshot = findSnapshotForLocale(
        snapshots,
        'technical',
        locale
    );
    const marketProfile = marketProfileOf(assetInfo);
    const { assetClass } = getDescriptor(marketProfile);

    // 분석 peek·호가표·희석 배지는 봉과 독립이라 봉을 기다리기 전에 시작한다 — ISR 캐시가 빈 cold
    // render(배포마다 캐시 prefix가 바뀌어 롱테일은 사실상 매 크롤이 cold다)에서 TTFB에 직렬로 더해지지
    // 않게 한다.
    //
    // peek은 읽기 전용(enqueue·생성 없음)이고 MISS·손상·읽기 실패를 전부 폴백 분석으로 흡수한다. 모델은
    // 익명·SSR 기본 방문자가 캐시를 쓰는 키(`SymbolModelContext` 기본값 DeepSeek flash)와 같아야 HIT한다.
    // `.catch`를 즉시 붙여 봉이 먼저 throw해도 미처리 rejection이 생기지 않는다.
    const cachedAnalysisPromise = peekAnalysisStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        assetInfo.fmpSymbol,
        DEEPSEEK_V4_1_FLASH_MODEL,
        locale
    ).catch((error: unknown) => {
        console.error('[SymbolPage] peekAnalysisStatic failed:', error);
        return null;
    });
    // 분석 카드 가격의 호가표(주식/ETF). 실패는 내부에서 'share'로 접히고 던지지 않으며, 한국 종목이
    // 아니면 I/O가 없다.
    const krxTickTablePromise = resolveKrxTickTableForDisplay(ticker);
    // 헤더 증자·희석 배지 — 로더가 조회 실패를 `undefined`로 삼키고, 다시 던지는 것은 Next의 정적 생성
    // 제어 흐름 오류(`DYNAMIC_SERVER_USAGE`)뿐이라 삼키면 안 된다. 빈 핸들러만 미리 달아 봉을 기다리는
    // 사이 미처리 rejection으로 잡히지 않게 하고, 아래에서 **원래 promise**를 await해 그 오류를 전파한다.
    const headingBadgePromise = loadDilutionHeadingBadge(ticker, assetInfo);
    void headingBadgePromise.catch(() => undefined);
    // 기본 타임프레임 봉. 실패는 `null`로 degrade해 페이지가 깨지지 않게 한다. 형성 중 봉을 HTML에 박으면
    // 재생성마다 바뀌므로 quantize로 마지막 완료 봉까지만 쓴다 — quantize는 정규장 개장 여부(boolean)로만
    // 갈려 장중 분·초 차이가 결과를 바꾸지 않는다(크립토는 24/7이라 항상 형성 봉을 뗀다). 레이아웃·
    // 메타데이터와 같은 인자(대문자 ticker)라 요청 스코프 메모가 접혀 지표가 한 벌만 직렬화된다.
    const quantizedFactBars = await getQuantizedBarsStatic(
        ticker,
        DEFAULT_TIMEFRAME,
        marketProfile,
        assetInfo.fmpSymbol
    ).catch((e: unknown) => {
        console.error('[SymbolPage] getQuantizedBarsStatic failed:', e);
        return null;
    });

    const displayName = buildDisplayName(assetInfo, ticker, locale);
    const { fullTitle, description, url } = resolveSymbolSeoContent(
        ticker,
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
        ticker,
        pickAssetName(assetInfo, ticker, locale),
        assetInfo.fmpSymbol,
        assetClass
    );
    const jsonLd = buildSymbolWebPageJsonLd({
        url,
        name: fullTitle,
        description,
        about: aboutNode,
        locale,
        // 아래 `TechnicalSnapshotProse`가 실제로 그리는 스냅샷일 때만 신선도를 주장한다.
        generatedAt: hasTechnicalProse(technicalSnapshot?.content)
            ? technicalSnapshot?.generatedAt
            : null,
    });
    // 차트 탭은 종목 랜딩이라 [사이트, 종목] 2단계다(형제 탭은 탭 마디까지 3단계 —
    // `buildSymbolTabBreadcrumbJsonLd`). 사이트 마디는 `buildBreadcrumbJsonLd`가 붙인다.
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: displayName, url }],
        locale
    );

    const queryClient = new QueryClient({
        defaultOptions: { queries: { staleTime: QUERY_STALE_TIME_MS } },
    });
    queryClient.setQueryData(QUERY_KEYS.assetInfo(segment), assetInfo, {
        updatedAt: assetInfoSeedUpdatedAt(degraded),
    });
    // ISR이라 기본 타임프레임만 시드한다. `?tf=` 딥링크는 클라(`useUrlSearchParam`)가 하이드레이션 직후
    // 읽어 그 타임프레임 봉을 받는다.
    const [hasBarsSeed, cachedAnalysis, headingBadge, krxTickTable] =
        await Promise.all([
            seedChartBars(queryClient, {
                ticker,
                segment,
                marketProfile,
                fmpSymbol: assetInfo.fmpSymbol,
                quantizedBars: quantizedFactBars,
            }),
            cachedAnalysisPromise,
            headingBadgePromise,
            krxTickTablePromise,
        ]);
    // 폴백 요약도 요청 로케일로 번역한다 — 상수였다면 `/en/AAPL`이 분석 실패 시 한국어 요약을 그린다.
    const initialAnalysis = normalizeAnalysisResponse(
        cachedAnalysis?.result ??
            buildFallbackAnalysis(tFallback('unavailable'))
    );

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {/* 차트 탭 전용 클라이언트 키(차트·AI 패널·타임프레임 등)는 레이아웃이 아니라 여기서 싣는다.
                레이아웃 메시지는 형제 탭 전부에 상속되므로 거기 두면 쓰지 않는 탭까지 받는다. 레이아웃이
                이미 실은 키는 빼고 차이만 보낸다(`RouteMessages` JSDoc). JSON-LD는 서버 전용이라 밖에 둔다. */}
            <RouteMessages route="[symbol]/(page)" locale={locale}>
                {/* main 랜드마크로 차트 본문을 묶는다. 가시 h1은 SymbolPageClient의 타임프레임 바 안에
                    있고 프로즈보다 DOM에서 먼저 와 heading 위계(WCAG 1.3.1)가 유지된다. 다른 탭으로 가는
                    교차 링크는 레이아웃 헤더의 탭 바(anchor라 크롤러도 따라간다)가 맡는다.

                    jail도 main도 스크롤 컨테이너가 아니다 — 차트 높이만 차트 컬럼이 `--symbol-chart-h`로
                    잡고(ChartContent), 그 위 모든 단은 콘텐츠만큼 자란다. 스크롤러는 문서와 AI 패널 둘이다. */}
                <main className="flex flex-1 flex-col">
                    {/* 모바일에서는 이 wrapper가 첫 뷰포트 높이를 확정하고 안쪽 flex 체인이 그 잔여를
                        나눈다. 데스크톱(md+)에서는 높이를 놓고, 차트 컬럼과 AI 패널이 각자
                        `--symbol-chart-h`로 확정 높이를 든다. */}
                    <div className="flex h-(--symbol-chart-h) shrink-0 flex-col md:h-auto">
                        <HydrationBoundary state={dehydrate(queryClient)}>
                            <SymbolPageClient
                                symbol={segment}
                                companyName={assetInfo.name}
                                displayName={displayName}
                                initialAnalysis={initialAnalysis}
                                initialLockedInfoDepth={
                                    cachedAnalysis?.lockedInfoDepth ?? []
                                }
                                // 캐시 시드 여부와 무관하게 항상 true — 클라는 마운트 시 useAnalysis가
                                // 재분석을 트리거한다(봇은 enqueue가 skip되어 생성되지 않는다).
                                initialAnalysisFailed={true}
                                indicatorCount={skillCounts.indicators}
                                skillCount={chartSkillTotal(skillCounts)}
                                marketProfile={marketProfile}
                                krxTickTable={krxTickTable}
                                hasBarsSeed={hasBarsSeed}
                                // 서버에서 판정·렌더를 끝낸 엘리먼트 — 첫 HTML에 이미 있어 나중에 끼어들며
                                // 헤더를 밀지 않는다. 사건이 없으면(대부분의 종목) 아무것도 그리지 않는다.
                                headingBadge={headingBadge}
                                // 이 HTML을 만든 시점에 정규장이 열려 있었는가(= 형성 중 봉이 있을 수
                                // 있었는가). 클라의 seed 복원 재조회만 게이트한다: 장중에 만든 ISR HTML을
                                // 장 마감 뒤에 열면 분석 작도가 그날 봉을 참조하는데 seed에는 없을 수 있다
                                // (`shouldRefetchBarsSeed`). 실제로 봉을 뗐는지가 아니라 세션 기준이다 —
                                // 좁히면 그 시각 뒤 생긴 오늘 봉을 분석이 참조하는 경로가 다시 열린다.
                                seedHasFormingBarTrimmed={hasFormingBar(
                                    sessionSpecFor(marketProfile),
                                    // RSC 렌더에서 평가해 prop으로 내리는 값이라 클라이언트에서 다시
                                    // 계산되지 않는다 — 하이드레이션 불일치 경로가 아니다.
                                    // react-doctor-disable-next-line react-doctor/rendering-hydration-mismatch-time
                                    new Date()
                                )}
                            />
                        </HydrationBoundary>
                    </div>
                    {/* 크롤용 기술적 사실 요약 — 영구 서버 sibling. 같은 요약을 AI 패널(`ChartContent`)도
                        그리지만 그건 차트의 Suspense 경계 안이라, 경계가 React의 progressive chunk(약
                        12.8KB)를 넘으면 raw HTML의 숨김 청크(`<div hidden id="S:n">`)로 아웃라인돼 JS를
                        실행하지 않는 크롤러(Naver Yeti·Daumoa)가 보지 못한다. 그래서 경계 **밖**에 인라인으로
                        한 벌 더 둔다. 게이트는 메타데이터 `hasPriceData`와 같은 술어, 주어도 패널과 같은
                        `symbolFactsSubject`다. 사람에게는 패널 사본이 DOM에 있는 순간 `globals.css`의
                        `body:has([data-technical-facts='panel'])` 규칙이 이 사본(여백 래퍼째)을 감춘다(첫
                        뷰포트 아래라 CLS에 들지 않는다). 차트가 실패해 패널이 없으면 이 사본이 남는다. */}
                    {quantizedFactBars !== null &&
                        hasTechnicalFacts(quantizedFactBars) && (
                            <div
                                data-technical-facts-page-slot=""
                                className="mt-6 px-4"
                            >
                                <TechnicalFactsSummary
                                    symbol={ticker}
                                    subject={symbolFactsSubject(
                                        ticker,
                                        assetInfo.koreanName,
                                        locale
                                    )}
                                    bars={quantizedFactBars.bars}
                                    indicators={quantizedFactBars.indicators}
                                    marketProfile={marketProfile}
                                    placement="page"
                                />
                            </div>
                        )}
                    {/* 모바일 바텀시트 SSR 껍데기 — 아래 산문과 같은 이유로 영구 서버 sibling이다. Suspense
                        fallback에 두면 경계가 풀리는 순간(하이드레이션) React가 이 서브트리를 지우는데 실제
                        시트는 그보다 늦게 마운트돼 그 사이 화면 하단이 빈다. 실제 시트가 DOM에 들어오면
                        `body:has([data-vaul-drawer])` 규칙으로 CSS만 사라진다(`MobileSheetPlaceholder` JSDoc). */}
                    <MobileSheetPlaceholder
                        label={tViews('mobileSheet.aiAnalysis')}
                    />
                    {/* AI 스냅샷 산문 — 영구 SSR sibling(Suspense fallback 안이면 경계가 풀릴 때 React가 지워
                        JS를 실행하는 크롤러에게서 사라진다). peek 결과는 산문이 아니라 클라 위젯의
                        `initialAnalysis` 시드로만 쓰여 중복이 없다.

                        차트 탭에는 라이브 `AnalysisPanel`이 함께 있어 `duplicatesLiveWidget`을 세운다 — 이
                        섹션은 자체 토글을 그리지 않고, 라이브 위젯의 평이화가 뜨면 CSS로 숨는다. 그래도
                        `plain`은 넘긴다: 이 탭이 유입의 본진(롱테일 `<티커> 주가`)이고 봇은 라이브 위젯의
                        평이화를 받지 못해(봇 가드), 여기서 싣지 않으면 색인 본문이 전문 산문뿐이다.

                        차트 바로 밑에 붙으면 접기 카드가 차트의 일부처럼 읽혀 위·양옆으로 띄운다(좌우는
                        다른 탭 `<main>`의 `px-4`와 같다). 스냅샷이 없으면 산문이 null이라 래퍼가 비고
                        `empty:hidden`이 그 여백까지 걷어낸다. */}
                    <div className="mt-6 px-4 empty:hidden">
                        <TechnicalSnapshotProse
                            content={technicalSnapshot?.content}
                            symbol={ticker}
                            displayName={displayName}
                            marketProfile={marketProfile}
                            generatedAt={technicalSnapshot?.generatedAt}
                            plain={technicalSnapshot?.plain}
                            duplicatesLiveWidget
                        />
                    </div>
                </main>
            </RouteMessages>
        </>
    );
}
