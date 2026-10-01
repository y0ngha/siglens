import { getTranslations } from 'next-intl/server';
import { newsCacheTag } from '@/entities/news-article/lib/newsCacheTag';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { DEFAULT_LOCALE, resolveLocale } from '@/shared/i18n/locales';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { OverallFactualFallback } from '@/widgets/overall/OverallFactualFallback';
import { OverallFactsSummary } from '@/widgets/overall/OverallFactsSummary';
import { OverallSnapshotProse } from '@/views/symbol/snapshot/renderers/OverallSnapshotProse';
import { hasOverallProse } from '@/views/symbol/snapshot/renderers/overallContent';
import { SymbolPageHeading } from '@/views/symbol/ui/SymbolPageHeading';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import { DEFAULT_TIMEFRAME, SymbolRouteParams } from '@/shared/config/market';
import { isAdmissibleSymbolShape } from '@/shared/config/ticker';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { Suspense } from 'react';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { buildDisplayName, pickAssetName } from '@/entities/ticker/lib/ticker';
import { getAssetInfoResilient } from '@/entities/ticker/lib/getAssetInfoResilient';
import { getNewsList } from '@/entities/news-article/api';
import { NEWS_LIST_CACHE_KEY } from '@/entities/news-article/lib/cacheKeys';
import {
    ALWAYS_NOINDEX_TAB_ROBOTS,
    buildBreadcrumbJsonLd,
    buildSymbolSeoContent,
    resolveSymbolOverallSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
    noindexSymbolMetadata,
    type SeoTranslator,
} from '@/shared/lib/seo';
import { buildSymbolWebPageJsonLd } from '@/app/[locale]/[symbol]/symbolWebPageJsonLd';
import {
    getDescriptor,
    marketProfileOf,
} from '@/shared/config/marketProfile/registry';
import { type MarketProfileId } from '@/shared/config/marketProfile/types';
import {
    DEEPSEEK_V4_1_FLASH_MODEL,
    peekOverallAnalysisCache,
} from '@y0ngha/siglens-core';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { enterLocale } from '@/shared/lib/enterLocale';

/**
 * 종합 분석 페이지의 H1은 market profile별로 세 갈래로 갈린다 — 미국 개별주식·한국
 * 개별주식·크립토. `MarketProfileId`(이미 3개 값으로 exhaustive)를 판별식 삼아 한 번에
 * 고른다 — 새 market profile이 추가되면 `_exhaustive: never` 가드에서 컴파일 에러가 난다
 * (MISTAKES.md §0.9, `sessionSpecFor`와 같은 패턴).
 *
 * 예전에는 FAQ 3문항도 같은 번들로 갈라 썼다. 종목명만 바뀌는 템플릿이라 2026-10-01에
 * 걷어냈다(`SEO_RECOVERY_2026_09.md` §10).
 */
function buildOverallHeading(
    marketProfile: MarketProfileId,
    displayName: string,
    t: SeoTranslator
): string {
    switch (marketProfile) {
        case 'us-equity':
            return t('page.overallHeadingUsEquity', { v0: displayName });
        case 'kr-equity':
            return t('page.overallHeadingKrEquity', { v0: displayName });
        case 'crypto':
            return t('page.overallHeadingCrypto', { v0: displayName });
        default: {
            // Exhaustiveness guard: 새 MarketProfileId가 추가되면 TypeScript가
            // 이 대입에서 컴파일 에러를 낸다 — sessionSpecFor와 동일 패턴.
            const _exhaustive: never = marketProfile;
            console.error(
                `[OverallPage] Unhandled MarketProfileId: ${String(_exhaustive)} — defaulting to us-equity copy`
            );
            return buildOverallHeading('us-equity', displayName, t);
        }
    }
}

export const revalidate = 43200; // 12h — ISR. AI 분석은 느리게 변하고 클라가 마운트 시 재요청

// generateStaticParams가 없으면 동적 라우트는 매 요청 동적 렌더돼 revalidate가
// 무력화된다(Next.js). 빈 배열 = 빌드 prebuild 없이 첫 요청에 렌더+캐시하는 on-demand
// ISR. (cacheComponents 비활성이라 빈 배열 허용)
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
        tab: 'overall',
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo)
        return noindexSymbolMetadata(upper, tSeo, locale, { tab: 'overall' });

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolOverallSeoContent(upper, assetClass, tSeo, {
        displayName,
        koreanName: assetInfo.koreanName,
        englishName: assetInfo.name,
        locale,
    });
    // **항상 noindex** (2026-10-01 SEO 감사, `SEO_RECOVERY_2026_09.md` §10).
    // 프리웜이 이 탭의 산문을 더는 굽지 않는다(`PREWARM_TABS`). 예전 게이트(스냅샷 산문
    // 또는 peek 캐시가 있으면 색인)를 그대로 두면 **사용자 방문이 캐시를 채웠는지**에
    // 따라 색인 여부가 날마다 뒤집힌다 — 크롤 시점의 우연이 색인 판정이 된다. 또 종합
    // 결론은 다른 탭(차트·뉴스 등)의 요약이라, 같은 검색어를 두고 차트 페이지와 경쟁한다.
    return {
        ...symbolMetadataFromSeo(seo, locale),
        robots: ALWAYS_NOINDEX_TAB_ROBOTS,
    };
}

// `?tf=` is read by the client component (useSearchParams); canonical URL excludes it so search engines see one URL per page.
export default async function OverallPage({ params }: Props) {
    const { locale: rawLocale, symbol } = await params;
    const locale = enterLocale(rawLocale);
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

    // peek은 읽기 전용 — enqueue/생성 없음. MISS·corrupt·read 실패는 모두 null로
    // degrade하므로 OverallContent는 idle CTA로 자연 폴백한다(렌더를 깨지 않음).
    // read 실패는 삼키지 않고 로깅한 뒤 degrade한다.
    //
    // modelId: chart 페이지와 동일하게 익명/SSR 기본 방문자가 캐시를 쓰는 키와
    // 정렬한다. OverallContent → useDefaultModelId → SymbolModelContext의 DEFAULT_MODEL
    // (DEEPSEEK_V4_1_FLASH_MODEL)이 submitOverallAnalysisAction에 그대로 전달되므로
    // writer는 DeepSeek flash 모델 키로 캐시한다. peek도 동일 모델을 넘겨야 HIT한다.
    //
    // 시그니처가 chart의 peekAnalysisCache(symbol, timeframe, fmpSymbol?, modelId?)와
    // 다른 건 의도적이다 — overall은 2번째 인자로 companyName을 받는다. 각 core peek
    // 함수가 자기 캐시 키 구성에 맞춰 서로 다른 시그니처를 갖는다.
    //
    // ISR: tf는 client가 URL에서 읽으므로 서버는 DEFAULT_TIMEFRAME으로 peek한다.
    // assetInfo.name은 symbol에 종속(1:1)이므로 캐시 키에서 제외한다 — symbol 태그
    // 무효화로 name 변동 시에도 갱신된다.
    // 종합 분석은 enriched news cards가 1개라도 있을 때만 의미가 있다 —
    // `/news`와 동일하게 SSR 시점 enrichment 여부를 prop으로 전달해 client에서
    // 폴링 게이트(useWaitForNewsCards)를 즉시 통과시키거나 폴링 시작하도록 한다.
    //
    // ISR safety: 캐시/DB 실패는 false/null로 degrade해 페이지 자체가 throw하지 않게 한다 —
    // 그 경우 client의 useWaitForNewsCards가 폴링으로 ready 상태를 회복한다.
    //
    // Promise.all로 병렬화 — 두 호출은 서로 독립이라 직렬 await할 이유가 없다.
    // cold path(둘 다 캐시 miss)에서 TTFB가 ~max(t1, t2) 수준으로 줄어든다.
    const [newsItems, cachedOverall, snapshots] = await Promise.all([
        staticSymbolCache(
            [NEWS_LIST_CACHE_KEY, upper, ...contentLocaleKeyPart(locale)],
            upper,
            () => getNewsList(upper, locale),
            [newsCacheTag(upper)],
            SECONDS_PER_HALF_DAY
        ).catch((error: unknown) => {
            console.error('[OverallPage] getNewsList failed:', error);
            // safe: 빈 배열은 NewsRow[]와 구조적 호환(`.some` 호출 가능). TS는 []의 element
            // type을 never로 추론하므로 staticSymbolCache 반환 타입에 맞추기 위한 cast.
            return [] as Awaited<ReturnType<typeof getNewsList>>;
        }),
        staticSymbolCache(
            ['peek:overall', upper, DEEPSEEK_V4_1_FLASH_MODEL, locale],
            upper,
            // reasoning: false 고정 — member-reasoning-toggle spec Part A.4. 이 SSR
            // peek은 익명/봇 방문자 셸이므로 writer(익명·free의 runOverallAnalysisAction)가
            // 쓰는 reasoning-OFF 키와 정렬돼야 HIT한다. 회원 토글 ON 결과가 섞이는 캐시
            // 오염을 방지한다(회원은 클라 재요청으로 자기 값을 받는다).
            () =>
                peekOverallAnalysisCache(
                    upper,
                    assetInfo.name,
                    DEFAULT_TIMEFRAME,
                    DEEPSEEK_V4_1_FLASH_MODEL,
                    false,
                    undefined,
                    undefined,
                    locale
                ),
            [],
            SECONDS_PER_HALF_DAY
        ).catch((error: unknown) => {
            console.error(
                '[OverallPage] peekOverallAnalysisCache failed:',
                error
            );
            return null;
        }),
        // ISR-safe (staticSymbolCache-wrapped, fail-open []) — see
        // getSeoSnapshotsStatic JSDoc. revalidateSeconds mirrors this page's
        // `export const revalidate` literal above.
        getSeoSnapshotsStatic(upper, revalidate, locale),
    ]);
    const hasEnrichedNews = newsItems.some(item => item.sentiment !== null);

    // snapshot-first, 기존 peek fallback 유지 (spec §7): 스냅샷이 실제로 렌더 가능하면
    // 그것을 canonical SSR 분석으로 쓰고, 아니면 기존 peek(cachedOverall) 결과로, 그것도
    // 없으면 기존 OverallFactualFallback placeholder로 내려간다.
    //
    // "행 존재"가 아니라 "렌더 가능 여부"(`hasOverallProse`)를 게이트로 쓴다(audit fix
    // FIX 1b) — 행은 있지만 content가 malformed라 OverallSnapshotProse가 null을
    // 반환하는 경우, 행 존재만 보고 게이트했다면 peek/placeholder 체인까지 스킵돼
    // 섹션이 통째로 비어버리는(오늘 baseline보다 더 나쁜) 회귀가 생긴다.
    // hasOverallProse는 OverallSnapshotProse 내부와 동일한 narrowOverallContent를
    // 재사용하므로 두 판단이 어긋날 수 없다.
    const overallSnapshot = snapshots.find(s => s.tab === 'overall');
    const showSnapshotProse = hasOverallProse(overallSnapshot?.content);

    const displayName = buildDisplayName(assetInfo, upper, locale);
    const marketProfile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(marketProfile).assetClass;
    // KR 개별주식은 유동성 있는 옵션 시장이 없다(KR_EQUITY_DESCRIPTOR.tabs 주석 참고 —
    // 국내에 상장된 것은 KOSPI200 지수옵션뿐, 개별주식 옵션은 사실상 무유동성이라 탭
    // 자체가 없다). `isEquity`(assetClass 이진 분류)만으로 문구를 고르면 한국 종목도
    // 미국 종목과 같은 "옵션 시장" 문구를 그대로 노출하게 된다(SEO 감사 2026-08-18) —
    // tabs whitelist를 직접 물어 실제 옵션 탭 존재 여부로 판정한다.
    const hasOptions = getDescriptor(marketProfile).tabs.includes('options');
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

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목과 crypto는
    // undefined로 자연 생략된다. crypto는 schema.org 표준 타입이 없어 about 노드 자체를 두지 않는다.
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
        // 화면에 실제로 그려지는 스냅샷일 때만 신선도를 주장한다 —
        // 렌더 불가한 행은 본문에 한 글자도 남기지 않는다.
        generatedAt: showSnapshotProse ? overallSnapshot?.generatedAt : null,
    });

    const breadcrumbJsonLd = buildBreadcrumbJsonLd(
        [
            { name: displayName, url: buildSymbolSeoContent(upper, tSeo).url },
            { name: t('page.8b7ae7'), url },
        ],
        locale
    );

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>{heading}</SymbolPageHeading>
                {/* AI 스냅샷 프로즈는 Suspense fallback이 아니라 PERSISTENT server
                    sibling으로 마운트한다(audit fix — fallback 안에 두면 React가
                    boundary resolve 시 클라이언트에서 그 서브트리를 DESTROY한다:
                    정적 HTML에는 fallback이 박히지만, hydration 후 JS를 실행하는
                    크롤러(Googlebot 렌더러 포함)에게는 사라진다). 나머지 5개
                    sibling 탭과 동일한 plain SSR sibling 패턴을 따른다.
                    `showSnapshotProse`(hasOverallProse) 게이트로 peek/placeholder
                    체인과 상호 배타 처리한다 — 동일 AI 분석 텍스트 중복 방지. */}
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
                {/* fallback은 두 역할을 겸한다: (1) useSearchParams CSR-bailout 서브트리가
                    hydration 전 비어 보이는 flash/CLS 방지, (2) 분석 텍스트를 크롤러가
                    JS 없이도 읽을 수 있도록 SSR HTML에 박는다. snapshot-first, 기존 peek
                    fallback 유지(spec §7) — 스냅샷이 렌더 가능하면 위에서 이미 프로즈를
                    보여줬으므로 이 fallback은 peek(cachedOverall) 결과로, 그것도 없으면
                    기존 placeholder로 내려간다. `showSnapshotProse` 게이트로 스냅샷
                    프로즈와 peek을 동시에 렌더하지 않아 중복이 없다. */}
                <Suspense
                    fallback={
                        showSnapshotProse ? null : cachedOverall ? (
                            <OverallFactsSummary
                                symbol={upper}
                                analysis={cachedOverall}
                            />
                        ) : (
                            <OverallFactualFallback
                                displayName={displayName}
                                marketProfile={marketProfile}
                                newsItems={newsItems}
                            />
                        )
                    }
                >
                    <OverallContent
                        symbol={upper}
                        companyName={assetInfo.name}
                        initialAnalysis={
                            // 캐시된 분석 산문은 한국어다. 비-기본 로케일에
                            // 시드하면 스트림 요청이 아예 일어나지 않아
                            // (`triggered = initialResult !== undefined`,
                            // `staleTime: Infinity`) 번역이 붙을 기회가 없고,
                            // 일본어 화면에 한국어 분석문이 **영구히** 남는다.
                            // 재분석(할당량 소모) 말고는 벗어날 방법이 없었다.
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
