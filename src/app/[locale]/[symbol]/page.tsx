import { getTranslations } from 'next-intl/server';
import { SymbolPageClient } from '@/views/symbol/SymbolPageClient';
import { resolveLocale } from '@/shared/i18n/locales';
import { MobileSheetPlaceholder } from '@/views/symbol/MobileSheetPlaceholder';
import { TechnicalFactsSummary } from '@/views/symbol/TechnicalFactsSummary';
import { symbolFactsSubject } from '@/views/symbol/utils/factsSubject';
import { TechnicalSnapshotProse } from '@/views/symbol/snapshot/renderers/TechnicalSnapshotProse';
import { hasTechnicalProse } from '@/entities/seo-snapshot/lib/technicalContent';
import { loadTabSnapshotMeta } from '@/app/[locale]/[symbol]/symbolSnapshotDescription';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import { buildTechnicalFacts } from '@/entities/bars/lib/technicalFacts';
import { JsonLd } from '@/shared/ui/JsonLd';
import { buildFallbackAnalysis } from '@/entities/analysis/lib/fallbackAnalysis';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { DEEPSEEK_V4_1_FLASH_MODEL } from '@y0ngha/siglens-core';
import { hasFormingBar } from '@/entities/bars/lib/quantizeBars';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { normalizeAnalysisResponse } from '@/entities/analysis/lib/normalizeAnalysisResponse';
import { peekAnalysisStatic } from '@/entities/analysis/lib/peekAnalysisStaticCache';
import { DEFAULT_TIMEFRAME, SymbolRouteParams } from '@/shared/config/market';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { requireResolvableAsset } from '@/app/[locale]/[symbol]/requireResolvableAsset';
import {
    getQuantizedBarsStatic,
    getSeedBarsStatic,
} from '@/entities/bars/lib/barsStaticCache';
import { countSkillFiles } from '@/entities/skill/api';
import { chartSkillTotal } from '@/shared/lib/skillStats';
import { QUERY_KEYS, QUERY_STALE_TIME_MS } from '@/shared/config/queryConfig';
import { assetInfoSeedUpdatedAt } from '@/shared/config/assetInfoSeed';
import { MS_PER_SECOND } from '@/shared/config/time';
import {
    buildBreadcrumbJsonLd,
    buildTitleSubject,
    resolveSymbolSeoContent,
    symbolMetadataFromSeo,
} from '@/shared/lib/seo';
import {
    dehydrate,
    HydrationBoundary,
    QueryClient,
} from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { enterLocale } from '@/shared/lib/enterLocale';
import { RouteMessages } from '@/shared/i18n/RouteMessages';

export const revalidate = 21600; // 6h — ISR. 사용자 신선도는 클라 refetch(useBars 30s)가 보장하므로 상한만 길게

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
    const locale = resolveLocale(rawLocale);
    const tSeo = await getTranslations({ locale, namespace: 'shared.seo' });
    const ticker = symbol.toUpperCase();
    // 본문·레이아웃 notFound()와 일관: 형식이 잘못된 세그먼트는 메타데이터 단계에서도 404다.
    // 레이아웃이 notFound()를 던져도 이 페이지의 generateMetadata 결과가 이기므로, 여기서
    // 메타를 돌려주면 404 응답에 홈 상속 title·og가 얹힌다(e2e `not-found.spec.ts`).
    if (!isAdmissibleSymbolShape(ticker)) notFound();
    // 존재하지 않는 심볼은 레이아웃과 같은 판정으로 여기서도 404다 — 티커를 단
    // noindex 메타데이터를 돌려주면 404 응답에 정상 페이지 제목이 얹힌다.
    const { assetInfo, degraded } = await requireResolvableAsset(ticker);
    // 봉 유무를 게이트에 넘기기 위해 metadata 단계에서 먼저 확정한다. 본문이
    // **같은 인자**로 부르는 `getQuantizedBarsStatic`은 `React.cache`라 요청
    // 스코프에서 접히므로 왕복이 늘지 않는다(둘 중 먼저 도는 쪽이 채우고 뒤는
    // 메모 히트 — `getSeoSnapshotsStatic`을 여기서 다시 부르는 것과 같은 패턴).
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
        // 봉 조회가 **실패**했으면(`null`) 이 렌더는 degrade다. 그러면 기존 규칙
        // ("degraded → 이 탭의 렌더 가능한 스냅샷이 있을 때만 색인")이 그대로
        // 적용된다: 일시 장애 중에 330자짜리 껍데기가 색인되지 않고, 저장된
        // technical 스냅샷이 있으면 본문이 실제로 서술을 그리므로 색인은 유지된다.
        // 조회가 회복되면 다음 ISR 재생성에서 자동으로 원래 판정으로 돌아간다 — 큐레이션
        // 종목의 이 렌더는 revalidate가 300초로 낮춰져(`shortenRevalidateForRuntimeDegrade`)
        // 노출 창이 6h가 아니라 약 5분이다.
        // (예전에는 `hasPriceData: undefined`로만 남겨, 장애 중 crawl이 빈 페이지를
        //  `index, follow`로 받아갔다 — 2026-09-17 정책 감사 M6.)
        degraded: degraded || metadataBars === null,
        revalidateSeconds: revalidate,
        tab: 'technical',
        // 조회가 **실패**한 경우(`null`)와 조회 결과 봉이 **없는** 경우를 구분한다.
        // 실패는 위 `degraded`가 받으므로 여기서는 `undefined`로 남긴다 — 봉이
        // 정말 없는 것("no-price-data", 스냅샷이 있어도 색인 불가)과 섞지 않는다.
        // 봉 0개는 `getBarsStatic`이 (장기 캐시에는 넣지 않되) **빈 `BarsData`로 돌려주므로**
        // 여기서 `false`가 되고, `degraded-with-snapshot`이 그 판정을 구해 주지 않는다.
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

    const displayName = buildDisplayName(assetInfo, ticker, locale);
    const profile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(profile).assetClass;
    const seo = resolveSymbolSeoContent(ticker, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    const metadata = symbolMetadataFromSeo(seo, locale);

    // snapshot-derived unique description (spec 2026-07-24 Task 8).
    const { description: snapshotDescription } = await loadTabSnapshotMeta({
        symbol: ticker,
        tab: 'technical',
        revalidate,
        locale,
        // 접두는 짧은 주어(`애플(AAPL)`) — 긴 표시명이 문장 예산을 먹는다.
        subject: buildTitleSubject(ticker, assetInfo.koreanName),
        assetClass: assetClass,
        tSeo,
        preferPlain: true,
    });
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

export default async function SymbolPage({ params }: Props) {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
    // 셋은 서로 독립이다.
    const [tViews, tSeo] = await Promise.all([
        getTranslations('views.symbol'),
        getTranslations('shared.seo'),
    ]);
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
            getSeoSnapshotsStatic(ticker, revalidate, locale),
        ]
    );
    const technicalSnapshot = (snapshots ?? []).find(
        s => s.tab === 'technical'
    );
    // 확장된 게이트(SYMBOL_EDGE_RE)는 crypto 심볼을 수용하기 위해 이전 VALID_TICKER_RE보다
    // 넓다. 정상 조건에서 crypto 심볼은 crypto_assets DB에서 직접 해결된다(degrade 없음).
    // crypto_assets DB와 FMP가 동시에 다운된 경우에만 예외적으로 degrade 가능하며, 이는
    // 허용된 한시적 제약이다. degraded + TICKER_RE 불합격 = DB에도 crypto_assets에도 없는
    // 심볼이 FMP 없이 resolve 실패한 것 → 실재하지 않는 종목으로 취급해 notFound.
    // (MSFT 같은 정상 종목이 FMP 일시 장애 중 degrade되는 경우는 TICKER_RE를 통과하므로
    // 기존 degrade 200+noindex 동작을 유지한다.)
    if (isUnresolvableDegraded(ticker, degraded)) notFound();
    if (!assetInfo) return notFound();

    // Compute marketProfile once here so SymbolPageClient receives it without
    // recomputing on the client.
    const marketProfile = marketProfileOf(assetInfo);
    const { assetClass } = getDescriptor(marketProfile);

    // default-tf bars를 정적화로 가져온다. 실패(인프라 다운 등)는 null로 degrade해
    // 페이지가 깨지지 않도록 한다. 이 bars는 클라이언트 React Query seed(아래)의 원천이고,
    // seed가 있어야 `SymbolPageClient`가 차트·사실 요약을 서버에서 렌더한다(`hasBarsSeed`).
    //
    // SSR seed에 forming 봉을 박으면 ISR write churn 유발 — quantize로 마지막 완료 봉까지만.
    // new Date()는 ISR-safe: quantize는 isRegularSessionOpen(session, now) boolean으로만
    // 분기하므로 정규장 안에서는 분/초 차이가 결과에 영향 없음(cache content 동일).
    // crypto(CRYPTO_SESSION)은 24/7 always-open이라 isRegularSessionOpen이 항상 true를
    // 반환 → forming 봉을 항상 제거해 ISR write churn을 방지한다.
    //
    // layout.tsx와 **같은 인자**(대문자 ticker)로 이 헬퍼를 호출해야 요청 스코프 메모가
    // 접혀 지표가 한 벌만 직렬화된다(getQuantizedBarsStatic JSDoc).
    //
    // 분석 peek은 bars에 의존하지 않으므로(ticker·fmpSymbol만 쓴다) bars를 기다리기 전에
    // 시작한다. 예전엔 bars → seed → peek 순서로 직렬이라, ISR 캐시가 빈 cold render
    // (배포마다 S3 prefix가 바뀌어 롱테일은 사실상 매 크롤이 cold다)에서 peek의
    // unstable_cache 조회 + Upstash 왕복이 그대로 TTFB에 더해졌다.
    //
    // peek은 읽기 전용 — enqueue/생성 없음. MISS·corrupt·read 실패는 모두 MISS로
    // degrade해 FALLBACK_ANALYSIS로 폴백한다(렌더를 절대 깨지 않음). read 실패는
    // 삼키지 않고 로깅한 뒤 degrade한다. `.catch`를 즉시 붙이므로 bars가 먼저 throw해도
    // 미처리 rejection은 생기지 않는다.
    //
    // modelId: 익명/SSR 기본 방문자가 캐시를 쓰는 키와 정렬한다. SymbolModelContext의
    // DEFAULT_MODEL이 DEEPSEEK_V4_1_FLASH_MODEL이고, useAnalysis가 그 값을
    // SSE 라우트에 그대로 전달하므로 writer는 DeepSeek flash 모델 키로 캐시한다.
    // peek도 동일 모델을 넘겨야 HIT한다.
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
    const pageSeo = resolveSymbolSeoContent(ticker, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    const { fullTitle, description, url } = pageSeo;

    // about 노드는 classifyAsset 결과가 stock일 때만 Corporation으로 채워지고,
    // ETF/Index/모호한 종목은 undefined를 반환해 spread로 자연 생략된다.
    // crypto는 schema.org 표준 타입이 없어 about 노드를 생략한다.
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
        // 아래 `TechnicalSnapshotProse`가 **실제로 그리는** 스냅샷일 때만
        // 신선도를 주장한다(렌더 불가한 행은 본문에 한 글자도 남기지 않는다).
        generatedAt: hasTechnicalProse(technicalSnapshot?.content)
            ? technicalSnapshot?.generatedAt
            : null,
    });

    // 차트 페이지는 ticker landing이므로 [SIGLENS, displayName] 2단계로 통일한다.
    // (sibling 페이지들은 [SIGLENS, displayName, 섹션명] 3단계 — buildBreadcrumbJsonLd가 SIGLENS를 자동 prepend.)
    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [{ name: displayName, url }],
        locale
    );

    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: QUERY_STALE_TIME_MS,
            },
        },
    });

    queryClient.setQueryData(QUERY_KEYS.assetInfo(symbol), assetInfo, {
        updatedAt: assetInfoSeedUpdatedAt(degraded),
    });

    // prefetchQuery(bars 재호출)는 제거 — forming 봉이 포함된 라이브 bars가
    // dehydrate seed로 박히면 ISR write churn이 발생하므로, quantize 후 동기 주입으로 대체.
    // 차트 페이지는 ISR로 캐시되므로 기본 timeframe만 seed한다.
    // ?tf= 딥링크는 클라(useTimeframeChange→useUrlSearchParam)가 하이드레이션 직후 읽어
    // 해당 timeframe bars를 fetch한다.
    //
    // null guard: getQuantizedBarsStatic 실패 시 quantizedFactBars는 null이다. null을 setQueryData에
    // 넘기면 null "success" 값이 dehydrate 캐시에 박혀 클라 useSuspenseQuery가 data.bars를
    // null에서 읽으려다 crash하고, null은 stale 트리거가 아니므로 재fetch도 안 된다.
    // null인 경우는 seed를 생략해 클라 useBars/getBarsAction이 라이브로 fetch하게 한다.
    // seed를 실제로 넣었는지는 `SymbolPageClient`에 넘긴다(`hasBarsSeed`) — 이제 차트가
    // 서버에서도 렌더되므로, seed 없이 SSR하면 서버 렌더가 봉 Server Action을 부른다.
    let hasBarsSeed = false;
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
            hasBarsSeed = true;
        }
    }

    const cachedAnalysis = await cachedAnalysisPromise;
    // 폴백 summary도 요청 로케일로 — 예전엔 한국어 상수라 `/en/AAPL`이 분석
    // 실패 시 영어 화면에 한국어 요약을 렌더했다.
    const tFallback = await getTranslations('entities.analysis.fallback');
    const initialAnalysis = normalizeAnalysisResponse(
        cachedAnalysis?.result ??
            buildFallbackAnalysis(tFallback('unavailable'))
    );

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            {/* 차트 탭 전용 클라이언트 키(차트·AI 패널·타임프레임 등)는 `[symbol]` 레이아웃이 아니라
                여기서 싣는다. 레이아웃의 메시지는 뉴스·재무·옵션 등 형제 탭 전부에 상속되므로,
                거기 두면 이 키들을 쓰지 않는 탭까지 받는다. 레이아웃이 이미 실은 키는 빼고 차이만
                보낸다(`RouteMessages` JSDoc). JSON-LD는 서버 전용이라 감쌀 필요가 없다. */}
            <RouteMessages route="[symbol]/(page)" locale={locale}>
                {/* main 랜드마크: 다른 5개 sibling 페이지는 본문에 <main>이 있는데
                    차트 페이지만 빠져 있어 의미론적 일관성이 깨졌었다. SymbolPageClient
                    outer div는 flex-1로 viewport를 채우는 구조라 그 위 한 단을 main으로
                    감싸 chart 본문을 하나의 랜드마크로 묶는다.
                    가시 h1은 jail 제약상 SymbolPageClient의 timeframe bar 안에 둔다. */}
                {/* 차트 페이지는 CrossLinkCards를 본문에 두지 않는다 — cross-link 역할은
                    layout header의 SymbolTabs가 충분히 수행한다 (탭으로 sibling 페이지
                    전환 가능; anchor 기반이라 crawler도 follow 가능). TechnicalSnapshotProse는
                    아래에서 별도 처리한다. */}
                {/* 이 라우트의 스크롤러는 문서와 AI 패널(ChartContent aside) 둘이다. 예전에는 jail이 첫 뷰포트에
                    고정(definite height + overflow-hidden)돼 있어서 이 <main>이 자기
                    overflow-y-auto로 아래 콘텐츠를 노출해야 했는데, 그 결과 데스크톱에
                    스크롤바가 셋이 됐다 — main, AI 패널, body(사용자 제보, v0.79.0).
                    이제 jail도 main도 스크롤 컨테이너가 아니다. 차트 높이만 차트 컬럼이
                    `--symbol-chart-h`로 직접 잡고(ChartContent), 그 위 모든 단은 콘텐츠만큼
                    자란다. h1(SymbolPageClient 안)이 프로즈보다 DOM에서
                    먼저 오므로 heading 위계(WCAG 1.3.1)는 그대로 유지된다. */}
                <main className="flex flex-1 flex-col">
                    {/* 모바일에서는 이 wrapper가 첫 뷰포트 높이를 확정하고 안쪽 flex
                        체인(SymbolPageClient → 차트 행)이 그 잔여를 나눈다 — 기존 동작
                        그대로다. 데스크톱(md+)에서는 높이를 놓고, 차트 컬럼과 AI 패널이
                        각자 `--symbol-chart-h`로 확정 높이를 스스로 들고 있다. */}
                    <div className="flex h-(--symbol-chart-h) shrink-0 flex-col md:h-auto">
                        <HydrationBoundary state={dehydrate(queryClient)}>
                            {/* `SymbolPageClient`를 Suspense로 감싸지 않는다. URL `tf`를
                                `useSearchParams`가 아니라 `useUrlSearchParam`으로 읽어 CSR bailout이
                                없으므로, 차트·AI 패널(사실 요약 포함)·가시 h1이 SSR HTML에 바로 박힌다.
                                예전의 경계(fallback = sr-only h1 + 사실 요약)는 그 bailout 때문에 있던
                                것인데, 남겨 두면 RSC 스트림 타이밍에 따라 경계가 `$?`(대기)로 플러시돼
                                raw HTML에 fallback h1 + 숨김 청크의 진짜 h1이 **둘 다** 남았다(e2e
                                `symbol-seo` "exactly one h1" 실측). 경계가 없으면 문서 셸이 이 내용을
                                기다려 인라인으로 싣는다 — ISR이라 그 대기는 생성 때 한 번뿐이다.
                                차트 내부의 클라이언트 전환용 경계(`SymbolPageClient`의 ChartSkeleton)는
                                그대로다. */}
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
                                skillCount={chartSkillTotal(skillCounts)}
                                marketProfile={marketProfile}
                                hasBarsSeed={hasBarsSeed}
                                // 이 HTML을 만든 시점에 정규장이 열려 있었는가(= 형성 중 봉이 있을 수
                                // 있었는가). 클라이언트의 seed 복원 재조회만 게이트한다: 장중에 만든
                                // ISR HTML을 장 마감 뒤에 열면 분석 작도가 그날 봉을 참조하는데 seed에는
                                // 없을 수 있어, 입력을 기다리지 않고 라이브 봉을 받아야 한다
                                // (`shouldRefetchBarsSeed`, PR #957). 실제로 봉을 뗐는지가 아니라 세션
                                // 기준이다 — 좁히면 그 회귀 경로가 다시 열린다(오늘 봉이 없으면 quantize는
                                // 아무것도 안 떼지만, 그 시각 뒤 생긴 오늘 봉을 분석이 참조할 수 있다).
                                seedHasFormingBarTrimmed={hasFormingBar(
                                    sessionSpecFor(marketProfile),
                                    new Date()
                                )}
                            />
                        </HydrationBoundary>
                    </div>
                    {/* 크롤용 기술적 사실 요약 — PERSISTENT server sibling. 같은 요약을 AI 패널
                        (`ChartContent`)도 그리지만, 그건 차트의 Suspense 경계 안이라 경계가 React의
                        progressive chunk(약 12.8KB)를 넘으면 raw HTML의 `<div hidden id="S:n">`
                        숨김 청크로 아웃라인된다 — JS를 실행하지 않는 크롤러(Naver Yeti·Daumoa)는
                        그 안을 보지 않는다. 그래서 경계 **밖**에 인라인으로 한 벌 더 둔다.
                        게이트는 메타데이터 `hasPriceData`와 같은 술어(`buildTechnicalFacts`)이고,
                        주어도 패널과 같은 `symbolFactsSubject`다. 사람에게는 패널 사본이 DOM에
                        있는 순간 `globals.css`의 `body:has([data-technical-facts='panel'])` 규칙이
                        이 사본(여백 래퍼째)을 감춰 화면이 예전과 같다(첫 뷰포트 아래라 CLS에 들지 않는다).
                        차트가 실패해 패널이 없으면 이 사본이 그대로 남는다. */}
                    {quantizedFactBars !== null &&
                        buildTechnicalFacts(
                            quantizedFactBars.bars,
                            quantizedFactBars.indicators
                        ) !== null && (
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
                    {/* 모바일 바텀시트 SSR 껍데기 — 바로 아래 TechnicalSnapshotProse와 같은
                        이유로 PERSISTENT server sibling이다. Suspense fallback에 두면 boundary가
                        resolve되는 순간(하이드레이션 ≈4.1초) React가 이 서브트리를 파괴하는데,
                        실제 vaul 시트는 그보다 늦은 ≈4.9초에 마운트되므로 그 사이 화면 하단이
                        다시 비어버린다. 껍데기는 실제 시트가 DOM에 들어오면 globals.css의
                        `body:has([data-vaul-drawer])` 규칙으로 CSS만 사라진다. 실측 타임라인은
                        MobileSheetPlaceholder의 JSDoc 참고. */}
                    <MobileSheetPlaceholder
                        label={tViews('mobileSheet.aiAnalysis')}
                    />
                    {/* AI 스냅샷 프로즈는 Suspense fallback이 아니라 PERSISTENT server
                        sibling으로 마운트한다(audit fix — spec §7의 "SSR-only" 의도와
                        달리 Suspense fallback 안에 두면 React가 boundary resolve 시
                        클라이언트에서 그 서브트리를 DESTROY한다: Next.js 정적 HTML에는
                        fallback이 박히지만, hydration 후 JS를 실행하는 크롤러(Googlebot
                        렌더러 포함)에게는 사라진다). 나머지 5개 sibling 탭(fundamental/
                        financials/congress/options/news)과 동일하게 plain SSR sibling
                        패턴을 따른다. peekAnalysisStatic 결과(cachedAnalysis)는 SSR
                        프로즈로 렌더되지 않고 initialAnalysis로 클라이언트
                        위젯에만 seed되므로(위 SymbolPageClient) 여기엔 중복
                        위험이 없다. 스냅샷이 없으면 TechnicalSnapshotProse가 null을
                        반환한다 — 아래 여백 래퍼는 남지만 `empty:hidden`으로 접혀
                        빈 카드나 여백이 보이지 않는다.
                        audit fix FIX 1: 위 chart wrapper 뒤로 옮겨 (a) h1보다 DOM에서
                        뒤에 오게 하고(heading 위계, WCAG 1.3.1), (b) chart+AI 영역의
                        flex 분배에서 완전히 제외해(wrapper가 shrink-0) 더 이상 첫 viewport
                        높이를 두고 경쟁하지 않는다. */}
                    {/*
                        차트 탭에는 라이브 `AnalysisPanel`이 함께 있다. 그래서
                        `duplicatesLiveWidget`을 세운다 — 이 섹션은 자체 토글을 그리지
                        않고, 라이브 위젯의 평이화가 뜨면 CSS로 숨는다.

                        그래도 `plain`은 넘긴다. 이 탭이 이 사이트 유입의 본진
                        (롱테일 `<티커> 주가`)이고, 봇은 라이브 위젯의 평이화를 받지
                        못하므로(봇 가드) 여기서 실어 보내지 않으면 색인되는 본문이
                        전문 산문으로만 남는다. */}
                    {/* 차트 바로 밑에 붙으면 접기 카드가 차트의 일부처럼 읽힌다(사용자
                        제보) — 위·양옆으로 띄운다(좌우는 다른 탭 `<main>`의 `px-4`와 같다).
                        스냅샷이 없으면 TechnicalSnapshotProse가 null이라 래퍼가 비고,
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
