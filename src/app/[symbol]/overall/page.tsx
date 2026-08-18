import { OverallContent } from '@/widgets/overall/OverallContent';
import { getBlockedSymbolMetadata } from '@/app/[symbol]/symbolIndexabilityMetadata';
import { OverallFactualFallback, OverallFactsSummary } from '@/widgets/overall';
import {
    hasOverallProse,
    OverallSnapshotProse,
} from '@/views/symbol/snapshot/renderers/OverallSnapshotProse';
import { SymbolPageHeading } from '@/views/symbol';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
import { JsonLd } from '@/shared/ui/JsonLd';
import {
    DEFAULT_TIMEFRAME,
    SymbolRouteParams,
    isAdmissibleSymbolShape,
} from '@/shared/config/market';
import { isUnresolvableDegraded } from '@/shared/lib/symbolGuard';
import { Suspense, type ReactNode } from 'react';
import {
    buildAssetAboutNode,
    buildDisplayName,
    getAssetInfoResilient,
} from '@/entities/ticker';
import { getNewsList } from '@/entities/news-article/api';
import { NEWS_LIST_CACHE_KEY } from '@/entities/news-article';
import {
    buildBreadcrumbJsonLd,
    buildSnapshotMetaDescription,
    buildSymbolSeoContent,
    buildSymbolWebPageJsonLd,
    resolveSymbolOverallSeoContent,
    symbolMetadataFromSeo,
    NOINDEX_SYMBOL_METADATA,
} from '@/shared/lib/seo';
import {
    getDescriptor,
    marketProfileOf,
    type MarketProfileId,
} from '@/shared/config/marketProfile';
import {
    DEEPSEEK_V4_FLASH_MODEL,
    peekOverallAnalysisCache,
} from '@y0ngha/siglens-core';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { SECONDS_PER_HALF_DAY } from '@/shared/config/time';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** H1·FAQ 답변 2개·안내 문단이 market profile별로 갈라 쓰는 카피 번들. */
interface OverallCopy {
    heading: string;
    axesAnswer: string;
    scenarioAnswer: string;
    guideParagraphs: ReactNode;
}

/**
 * 종합 분석 페이지의 카피(H1·FAQ 답변 2개·안내 문단)는 market profile별로 세
 * 갈래로 갈린다 — 미국 개별주식(옵션 있음)·한국 개별주식(옵션 없음)·크립토
 * (펀더멘털·재무·옵션 자체가 없음). `isEquity ? (hasOptions ? A : B) : C` 3항
 * 중첩을 렌더 지점(H1, FAQ 답변 2개, 안내 문단)마다 반복하면 새 market
 * profile이 추가돼도 컴파일 에러 없이 기존 분기 중 하나로 조용히 흡수된다
 * (MISTAKES.md §0.9). `MarketProfileId`(이미 3개 값으로 exhaustive)를 판별식
 * 삼아 카피 번들을 한 번에 만들고, 각 렌더 지점은 이 번들의 필드만 읽는다 —
 * `sessionSpecFor`(shared/api/market/sessionSpecFor.ts)와 동일한
 * `_exhaustive: never` 가드 패턴.
 */
function buildOverallCopy(
    marketProfile: MarketProfileId,
    displayName: string
): OverallCopy {
    switch (marketProfile) {
        case 'us-equity':
            return {
                heading: `${displayName} 차트와 옵션 시장, 실적, 뉴스 종합 분석`,
                axesAnswer: `${displayName} 주가의 차트 추세, 옵션 시장이 평가하는 단기 방향성, 분기 실적과 펀더멘털, 최근 뉴스 분위기까지 네 가지 분석 축에 시장 분위기(공포 탐욕 지수)를 더해 강세와 약세 시나리오, 진입을 고려할 만한 가격대, 시나리오가 깨지는 위험 요인을 함께 정리합니다.`,
                scenarioAnswer:
                    '차트 추세, 옵션 시장의 콜·풋 베팅 분위기, 실적과 가이던스 흐름, 뉴스 분위기를 종합해 상승 압력이 우세한지 하방 압력이 우세한지 판단합니다. 각 시나리오마다 어떤 가격대에서 진입을 고려할 만한지, 어떤 신호가 나오면 시나리오가 깨지는지를 같이 정리합니다.',
                guideParagraphs: (
                    <>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            {displayName} 주가가 지금 어디쯤 와 있는지 한
                            페이지에서 정리해 봅니다. 차트의 추세와 주요
                            지지선과 저항선, 옵션 시장이 평가하는 단기 방향성,
                            분기 실적 흐름, 최근 뉴스에서 시장이 무엇에 반응하고
                            있는지까지 네 가지 분석 축에 시장 분위기를 더해
                            살펴봅니다.
                        </p>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            옵션 시장이 가까운 만기에서 콜과 풋 어느 쪽에 더 큰
                            베팅을 걸고 있는지도 한 줄로 짚어 줍니다. 네 축을
                            합쳐 강세와 약세 시나리오를 각각 정리하고, 어떤
                            가격대에서 진입을 고려해 볼 만한지, 어떤 신호가
                            나오면 시나리오가 깨지는지를 함께 짚습니다.
                        </p>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            실적 발표, 가이던스 변화, 매크로 이벤트처럼
                            시나리오를 뒤집을 수 있는 위험 요인도 따로 표시해
                            두니, 매수 전에 한 번 훑어보면 도움이 됩니다.
                        </p>
                    </>
                ),
            };
        case 'kr-equity':
            // 한국 개별주식: 옵션 시장이 없으므로(KR_EQUITY_DESCRIPTOR.tabs) 세
            // 축(차트·실적·뉴스)만 다룬다 — 미국 주식 카피의 "옵션 시장"
            // 문단을 실적/가이던스 문단으로 교체한다.
            return {
                heading: `${displayName} 차트와 실적, 뉴스 종합 분석`,
                axesAnswer: `${displayName} 주가의 차트 추세, 분기 실적과 펀더멘털, 최근 뉴스 분위기까지 세 가지 분석 축에 시장 분위기(공포 탐욕 지수)를 더해 강세와 약세 시나리오, 진입을 고려할 만한 가격대, 시나리오가 깨지는 위험 요인을 함께 정리합니다.`,
                scenarioAnswer:
                    '차트 추세, 실적과 가이던스 흐름, 뉴스 분위기를 종합해 상승 압력이 우세한지 하방 압력이 우세한지 판단합니다. 각 시나리오마다 어떤 가격대에서 진입을 고려할 만한지, 어떤 신호가 나오면 시나리오가 깨지는지를 같이 정리합니다.',
                guideParagraphs: (
                    <>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            {displayName} 주가가 지금 어디쯤 와 있는지 한
                            페이지에서 정리해 봅니다. 차트의 추세와 주요
                            지지선과 저항선, 분기 실적 흐름, 최근 뉴스에서
                            시장이 무엇에 반응하고 있는지까지 세 가지 분석 축에
                            시장 분위기를 더해 살펴봅니다.
                        </p>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            분기 실적이 시장 기대치를 웃돌았는지, 다음 분기
                            가이던스가 어떻게 나왔는지도 한 줄로 짚어 줍니다. 세
                            축을 합쳐 강세와 약세 시나리오를 각각 정리하고, 어떤
                            가격대에서 진입을 고려해 볼 만한지, 어떤 신호가
                            나오면 시나리오가 깨지는지를 함께 짚습니다.
                        </p>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            실적 발표, 가이던스 변화, 매크로 이벤트처럼
                            시나리오를 뒤집을 수 있는 위험 요인도 따로 표시해
                            두니, 매수 전에 한 번 훑어보면 도움이 됩니다.
                        </p>
                    </>
                ),
            };
        case 'crypto':
            return {
                heading: `${displayName} 차트와 뉴스, 매수 분위기 종합 분석`,
                axesAnswer: `${displayName} 시세의 차트 추세, 최근 뉴스 분위기, 매수 분위기(공포 탐욕 지수)를 묶어 강세와 약세 시나리오, 진입을 고려할 만한 가격대, 시나리오가 깨지는 위험 요인을 함께 정리합니다.`,
                scenarioAnswer:
                    '차트 추세, 최근 뉴스 흐름, 매수 분위기를 종합해 상승 압력이 우세한지 하방 압력이 우세한지 판단합니다. 각 시나리오마다 어떤 가격대에서 진입을 고려할 만한지, 어떤 신호가 나오면 시나리오가 깨지는지를 같이 정리합니다.',
                guideParagraphs: (
                    <>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            {displayName} 시세가 지금 어디쯤 와 있는지 한
                            페이지에서 정리해 봅니다. 차트의 추세와 주요
                            지지선과 저항선, 최근 뉴스에서 시장이 무엇에
                            반응하고 있는지, 매수 분위기(공포 탐욕 지수)를 세
                            축으로 묶어 살펴봅니다.
                        </p>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            세 축을 합쳐 강세와 약세 시나리오를 각각 정리하고,
                            어떤 가격대에서 진입을 고려해 볼 만한지, 어떤 신호가
                            나오면 시나리오가 깨지는지를 함께 짚습니다.
                        </p>
                        <p className="text-sm leading-relaxed text-secondary-400">
                            매크로 이벤트, 규제 이슈, 대형 뉴스처럼 시나리오를
                            뒤집을 수 있는 위험 요인도 따로 표시해 두니, 매수
                            전에 한 번 훑어보면 도움이 됩니다.
                        </p>
                    </>
                ),
            };
        default: {
            // Exhaustiveness guard: 새 MarketProfileId가 추가되면 TypeScript가
            // 이 대입에서 컴파일 에러를 낸다 — sessionSpecFor와 동일 패턴.
            const _exhaustive: never = marketProfile;
            console.error(
                `[OverallPage] Unhandled MarketProfileId: ${String(_exhaustive)} — defaulting to us-equity copy`
            );
            return buildOverallCopy('us-equity', displayName);
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
    params: Promise<{ symbol: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { symbol } = await params;
    const upper = symbol.toUpperCase();
    // 본문 notFound()와 일관: 잘못된 ticker는 메타데이터를 비우고 noindex로 응답한다.
    if (!isAdmissibleSymbolShape(upper)) {
        return NOINDEX_SYMBOL_METADATA;
    }
    const { assetInfo, degraded } = await getAssetInfoResilient(upper);
    const blockedMetadata = await getBlockedSymbolMetadata({
        symbol: upper,
        assetInfo,
        degraded,
        revalidateSeconds: revalidate,
        tab: 'overall',
    });
    if (blockedMetadata) return blockedMetadata;
    if (!assetInfo) return NOINDEX_SYMBOL_METADATA;

    // snapshot-derived unique description (spec 2026-07-24 Task 8). Same
    // getSeoSnapshotsStatic(upper, revalidate) call the page body makes below —
    // unstable_cache dedupes it within this render, so this is a cache hit, not
    // an extra DB round-trip. Falls back to the templated description when no
    // snapshot exists (backward compatible). og/twitter keep the templated copy
    // — only the search-facing <meta name="description"> is overridden.
    const snap = (await getSeoSnapshotsStatic(upper, revalidate)).find(
        s => s.tab === 'overall'
    );

    // 라운드4 감사 finding 2: getBlockedSymbolMetadata는 `degraded === true`일
    // 때만 hasProseForTab을 확인한다. 건강한(비degraded) 자산이라도 AI 분석이
    // 아직 캐시되지 않았으면(배포 직후 ISR cold) 위 가드를 그냥 통과해
    // index,follow + self-canonical을 내보내는 동안, 본문은 OverallFactualFallback
    // (~1,250자 placeholder: "종합 AI 결론이 아직 캐시되지 않았습니다…")을 렌더했다.
    // 본문은 두 소스(스냅샷 프로즈 `hasOverallProse`, peek 캐시 `cachedOverall` →
    // `OverallFactsSummary`)가 **둘 다** 없을 때만 그 placeholder로 떨어진다 — 여기
    // 게이트도 `degraded`가 아니라 그 두 소스로 판단해야 본문과 어긋나지 않는다.
    // peek 키/인자는 아래 본문 호출과 동일해 같은 캐시 엔트리를 겨냥한다.
    //
    // **영향 범위와 되돌아오는 경로**(감사 라운드 4 리뷰): 스냅샷은 Postgres에 있어
    // 배포로 사라지지 않는다 — 실측 시점에 `overall` 스냅샷 보유 심볼 287개 중 KR은
    // 0개였으므로, 이 게이트에 걸리는 건 아직 프로즈가 없는 KR 20개뿐이고 그건 지금
    // placeholder를 내보내는 바로 그 페이지들이다. 미국·크립토는 배포 직후 cold ISR
    // 에서도 스냅샷을 읽어 색인 상태를 유지한다.
    //
    // 스냅샷이 들어오면 `revalidateTag('seo-snapshot:{SYM}')`가 이 항목을 깨는데,
    // prewarm은 **전 탭이 fresh로 수렴할 때만** 그 태그를 쏜다(`runPrewarmBatch`).
    // 그래서 overall만 채워지고 다른 탭 하나가 실패한 밤에는 noindex가 페이지
    // `revalidate`(12h)까지 남는다 — 플레이스홀더를 색인시키는 것보다는 낫지만
    // 공짜는 아니다.
    if (!hasOverallProse(snap?.content)) {
        const cachedOverall = await staticSymbolCache(
            ['peek:overall', upper, DEEPSEEK_V4_FLASH_MODEL],
            upper,
            () =>
                peekOverallAnalysisCache(
                    upper,
                    assetInfo.name,
                    DEFAULT_TIMEFRAME,
                    DEEPSEEK_V4_FLASH_MODEL,
                    false
                ),
            [],
            SECONDS_PER_HALF_DAY
        ).catch((error: unknown) => {
            console.error(
                '[OverallPage.generateMetadata] peekOverallAnalysisCache failed:',
                error
            );
            return null;
        });
        if (!cachedOverall) return NOINDEX_SYMBOL_METADATA;
    }

    const displayName = buildDisplayName(assetInfo, upper);
    const assetClass = getDescriptor(marketProfileOf(assetInfo)).assetClass;
    const seo = resolveSymbolOverallSeoContent(upper, assetClass, {
        displayName,
        koreanName: assetInfo.koreanName,
    });
    const metadata = symbolMetadataFromSeo(seo);

    const snapshotDescription = snap
        ? buildSnapshotMetaDescription('overall', snap.content, displayName)
        : null;
    return snapshotDescription
        ? { ...metadata, description: snapshotDescription }
        : metadata;
}

// `?tf=` is read by the client component (useSearchParams); canonical URL excludes it so search engines see one URL per page.
export default async function OverallPage({ params }: Props) {
    const { symbol } = await params;
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
    // (DEEPSEEK_V4_FLASH_MODEL)이 submitOverallAnalysisAction에 그대로 전달되므로
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
            [NEWS_LIST_CACHE_KEY, upper],
            upper,
            () => getNewsList(upper),
            [`news:${upper}`],
            SECONDS_PER_HALF_DAY
        ).catch((error: unknown) => {
            console.error('[OverallPage] getNewsList failed:', error);
            // safe: 빈 배열은 NewsRow[]와 구조적 호환(`.some` 호출 가능). TS는 []의 element
            // type을 never로 추론하므로 staticSymbolCache 반환 타입에 맞추기 위한 cast.
            return [] as Awaited<ReturnType<typeof getNewsList>>;
        }),
        staticSymbolCache(
            ['peek:overall', upper, DEEPSEEK_V4_FLASH_MODEL],
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
                    DEEPSEEK_V4_FLASH_MODEL,
                    false
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
        getSeoSnapshotsStatic(upper, revalidate),
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

    const displayName = buildDisplayName(assetInfo, upper);
    const marketProfile = marketProfileOf(assetInfo);
    const assetClass = getDescriptor(marketProfile).assetClass;
    const isEquity = assetClass === 'equity';
    // KR 개별주식은 유동성 있는 옵션 시장이 없다(KR_EQUITY_DESCRIPTOR.tabs 주석 참고 —
    // 국내에 상장된 것은 KOSPI200 지수옵션뿐, 개별주식 옵션은 사실상 무유동성이라 탭
    // 자체가 없다). `isEquity`(assetClass 이진 분류)만으로 문구를 고르면 한국 종목도
    // 미국 종목과 같은 "옵션 시장" 문구를 그대로 노출하게 된다(SEO 감사 2026-08-18) —
    // tabs whitelist를 직접 물어 실제 옵션 탭 존재 여부로 판정한다.
    const hasOptions = getDescriptor(marketProfile).tabs.includes('options');
    const copy = buildOverallCopy(marketProfile, displayName);
    const { fullTitle, description, url } = resolveSymbolOverallSeoContent(
        upper,
        assetClass,
        {
            displayName,
            koreanName: assetInfo.koreanName,
        }
    );

    // about 노드는 stock으로 분류된 경우만 채워지고, ETF/Index/모호한 종목과 crypto는
    // undefined로 자연 생략된다. crypto는 schema.org 표준 타입이 없어 about 노드 자체를 두지 않는다.
    const aboutNode = buildAssetAboutNode(
        upper,
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

    const breadcrumbJsonLd = buildBreadcrumbJsonLd([
        { name: upper, url: buildSymbolSeoContent(upper).url },
        { name: 'AI 종합 분석', url },
    ]);

    // FAQ 답변은 market profile별로 분기한다 — 크립토에는 옵션 시장·분기 실적·펀더멘털이
    // 없고, 한국 개별주식은 옵션 시장만 없으므로 해당 문구가 포함된 답변을 그대로
    // 노출하면 실재하지 않는 콘텐츠를 약속하게 된다. `copy`(buildOverallCopy)가
    // marketProfile 하나로 두 답변을 모두 판별한다 — 판별식·가드 이유는 그 함수 JSDoc 참고.
    const faqJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
            {
                '@type': 'Question',
                name: `${displayName} 종합 분석에서는 어떤 축을 같이 보나요?`,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: copy.axesAnswer,
                },
            },
            {
                '@type': 'Question',
                name: '강세 시나리오와 약세 시나리오는 어떤 기준으로 나뉘나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: copy.scenarioAnswer,
                },
            },
            {
                '@type': 'Question',
                name: '어떤 신호가 나오면 시나리오가 깨졌다고 봐야 하나요?',
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: isEquity
                        ? '실적 발표 결과나 가이던스 변화, 매크로 이벤트, 분위기 급반전 같은 위험 요인이 시나리오의 전제를 무너뜨리면 그 시나리오는 깨졌다고 봅니다. 위험 요인 항목에 따로 표시되어 있어 매수 전에 한 번 확인하기 좋습니다.'
                        : '매크로 이벤트, 규제 이슈, 대형 뉴스, 분위기 급반전 같은 위험 요인이 시나리오의 전제를 무너뜨리면 그 시나리오는 깨졌다고 봅니다. 위험 요인 항목에 따로 표시되어 있어 매수 전에 한 번 확인하기 좋습니다.',
                },
            },
        ],
    };

    return (
        <>
            <JsonLd data={jsonLd} />
            <JsonLd data={breadcrumbJsonLd} />
            <JsonLd data={faqJsonLd} />
            <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
                <SymbolPageHeading>{copy.heading}</SymbolPageHeading>
                <section
                    aria-labelledby="overall-guide-heading"
                    className="space-y-3 rounded-lg border border-secondary-800 bg-secondary-800/30 p-5"
                >
                    <h2
                        id="overall-guide-heading"
                        className="text-base font-semibold text-secondary-300"
                    >
                        {displayName} 종합 분석은 어떻게 봐야 할까
                    </h2>
                    {copy.guideParagraphs}
                </section>
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
                                symbol={upper}
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
                        initialAnalysis={cachedOverall ?? undefined}
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
