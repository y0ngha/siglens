'use client';

import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { Suspense } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { cn } from '@/shared/lib/cn';
import { ErrorBoundary } from 'react-error-boundary';
import { SymbolTabs } from './SymbolTabs';
import { SymbolTabsSkeleton } from './SymbolTabsSkeleton';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { shouldShowEnglishName } from '@/entities/ticker/lib/ticker';
import { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';
import { AnalysisSettingsMenu } from '@/widgets/analysis/AnalysisSettingsMenu';
import { ShareButton } from '@/widgets/share/ui/ShareButton';
import { FearGreedHeaderChip } from './FearGreedHeaderChip';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { PremiumModelGateModal } from '@/features/premium-gate/ui/PremiumModelGateModal';
import { PortfolioChipMounted } from '@/features/portfolio-holding/ui/PortfolioChipMounted';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';
import { SITE_NAME } from '@/shared/lib/seo';
import type { SymbolSubTabKey } from './utils/symbolTabsConfig';

interface SymbolLayoutHeaderProps {
    /** Ticker from the dynamic route param. Internally upper-cased for the breadcrumb. */
    symbol: string;
    /**
     * 서버가 계산한 공포·탐욕 스냅샷. 칩이 클라이언트에서 봉으로 파생하는 대신
     * 이걸 그대로 렌더한다 — 그 덕에 레이아웃이 9탭 전부에 봉 76KB를 seed하지
     * 않아도 된다(`[symbol]/layout.tsx`의 근거 주석 참고).
     * 데이터가 없으면(FMP 키 없음·degrade) null.
     */
    fearGreedSnapshot: FearGreedSnapshot | null;
    /** 가시 브레드크럼 `<nav>`의 접근 가능한 이름. 서버(레이아웃)가 번역해 넘긴다. */
    breadcrumbLabel: string;
    /**
     * 하위 탭 세그먼트 → 브레드크럼 셋째 마디 라벨. 각 탭 페이지의 `BreadcrumbList` JSON-LD
     * 셋째 마디 `name`과 **같은 카탈로그 키(`shared.symbolTab`)**에서 나와야 한다 — 구글은
     * 마크업과 화면 텍스트가 다르면 breadcrumb 리치 결과에서 마크업을 무시한다.
     */
    tabCrumbLabels: Readonly<Record<SymbolSubTabKey, string>>;
}

/**
 * `useSelectedLayoutSegment()`가 돌려준 세그먼트가 하위 탭인지 — 차트(`null`)나
 * 알 수 없는 세그먼트면 셋째 마디를 그리지 않는다.
 */
function subTabOf(
    segment: string | null,
    labels: Readonly<Record<SymbolSubTabKey, string>>
): SymbolSubTabKey | null {
    return segment !== null && Object.hasOwn(labels, segment)
        ? (segment as SymbolSubTabKey)
        : null;
}

/**
 * Layout-level header rendered on every `/[symbol]/*` page.
 *
 * Contains the page-agnostic UI: SIGLENS logo, ticker breadcrumb, SymbolTabs,
 * and the shared "분석 설정" gear (model selector + reasoning toggle) so all
 * analysis tabs use the same model/reasoning state.
 * Chart-specific controls (TimeframeSelector) live inside the chart page's own
 * scroll-locked container so the layout stays free of `useSearchParams` (which
 * would force the whole route to be dynamic under Next.js Cache Components).
 */
export function SymbolLayoutHeader({
    symbol,
    fearGreedSnapshot,
    breadcrumbLabel,
    tabCrumbLabels,
}: SymbolLayoutHeaderProps) {
    const assetInfo = useAssetInfo(symbol);
    const ticker = symbol.toUpperCase();
    // 차트(`/{T}`)의 세그먼트는 `null`이다. 하위 탭(`/{T}/news` …)에서는 종목명을 차트로
    // 가는 링크로 만든다 — 아래 `nameClassName` 주석 참고.
    const segment = useSelectedLayoutSegment();
    const isChartRoute = segment === null;
    const subTab = subTabOf(segment, tabCrumbLabels);
    // `buildDisplayName`과 판정 자체를 공유한다(`entities/ticker`의
    // `shouldShowEnglishName`) — 이쪽은 문자열 하나를 만들고 여기는 색을 나눠 span으로
    // 렌더해서 렌더링까지 공유할 수는 없지만, 판정이 갈리면 같은 페이지의 메타와
    // 헤더가 서로 다른 이름을 말하게 된다.
    const locale = useResolvedLocale();
    const hasCompanyName =
        !!assetInfo &&
        shouldShowEnglishName(
            assetInfo.name,
            assetInfo.koreanName,
            ticker,
            locale
        );
    /**
     * 비-기본 로케일에서는 한국어명을 앞세우지 않는다.
     *
     * `buildDisplayName`은 로케일을 보는데 이 헤더는 색을 나눠 span으로 그리느라
     * 그 문자열을 재사용할 수 없다 — 그래서 **판정만** 맞춘다. 안 맞추면
     * `/en/AAPL`의 브레드크럼이 `애플, Apple Inc. (AAPL)`이 되어, 같은 페이지의
     * `<title>`(영어)과 헤더가 서로 다른 이름을 말한다.
     *
     * 영문명이 아예 없으면(국내 종목 다수) 비-ko에서도 한국어명을 남긴다 —
     * 티커만 남기는 것보다 낫고, `buildDisplayName`도 같은 폴백을 쓴다.
     */
    const showKoreanName =
        !!assetInfo?.koreanName &&
        (locale === DEFAULT_LOCALE || !hasCompanyName);

    const {
        modelId,
        allowedModels,
        handleModelChange,
        gateModal,
        dismissGate,
        reasoning,
        setReasoning,
        canUseReasoning,
        isReasoningSupported,
        openSignupNudge,
    } = useSymbolModel();

    /**
     * 종목명 줄. 하위 탭(뉴스·펀더멘털·…)에서는 이 이름이 **차트 `/{T}`로 가는 링크**다 —
     * 예전에는 그냥 텍스트라 하위 탭 페이지에서 그 종목의 대표 페이지로 올라가는 앵커가
     * 없었다(2026-10-05 크롤 감사). 차트 탭에서는 자기 자신이라 링크로 만들지 않는다.
     * 줄 수 규약(모바일 `line-clamp-2`, sm 이상 `truncate`)은 링크가 되어도 그대로다 — 아래 주석과
     * `SymbolHeaderShellFallback` 참고.
     */
    const nameClassName =
        'line-clamp-2 text-base leading-tight font-semibold tracking-wide text-secondary-100 sm:line-clamp-none sm:truncate sm:text-lg';
    const nameContent = (
        <>
            {showKoreanName && (
                <span className="text-secondary-300">
                    {assetInfo.koreanName}
                </span>
            )}
            {/* 한국어명이 앞서는 경우 영문명(과 앞의 ", ")은 sm 이상에서만
                보인다 — 모바일은 "애플 (AAPL)". 한국어명이 없으면 영문명이
                곧 종목명이라 항상 보인다. 쉼표를 영문명과 같은 span에 두지
                않고 바깥 래퍼에 둬서, 영문명 텍스트가 자기 노드로 남게 한다. */}
            {assetInfo &&
                hasCompanyName &&
                (showKoreanName ? (
                    <span className="hidden sm:inline">
                        ,{' '}
                        <span className="text-secondary-200">
                            {assetInfo.name}
                        </span>
                    </span>
                ) : (
                    <span className="text-secondary-200">{assetInfo.name}</span>
                ))}{' '}
            ({ticker})
        </>
    );

    /*
     * 상단 크롬(브레드크럼·탭)은 **전폭 `px-4`**로 둔다. 서브탭 본문이 쓰는
     * `symbol-container`(1024px 중앙)를 크롬에도 걸면 기본 탭인 차트와 어긋난다
     * — 차트는 자기 제목 줄을 전폭 `px-4`로 그리고(캔버스 좌단에 맞추려고), 그
     * 결과 넓은 화면에서 크롬만 안쪽으로 들여쓰인다(1920px에서 448px).
     *
     * 그래서 폭 규약이 둘로 갈린다: **크롬은 뷰포트에, 본문은 읽기 폭에** 맞춘다.
     * 서브탭(뉴스·펀더멘털)에서는 크롬이 본문보다 바깥에서 시작하는데, 이건
     * 사용자가 고른 트레이드오프다 — 기본 진입 탭인 차트의 정렬을 우선한다.
     *
     * `px-4`는 차트 제목 줄과 **같은 값**이어야 한다. 둘 중 하나만 바뀌면 다시
     * 어긋난다(`views/symbol/SymbolPageClient.tsx`의 타임프레임 바).
     */
    /*
     * 최상위 요소는 `<header>`가 아니라 `<div>`다. 이 크롬은 `<main>` 밖에 있어 `<header>`면
     * `banner` 랜드마크가 되는데, 사이트 헤더가 이미 banner라 한 페이지에 banner가 둘이 된다
     * (보조기술의 랜드마크 탐색이 "배너 2개"로 읽는다). 안의 브레드크럼 `<nav>`와 탭 `<nav>`가
     * 각자 랜드마크라 이 래퍼에는 역할이 필요 없다.
     */
    return (
        <div className="relative z-40 py-3">
            <div className="flex items-center gap-2 px-4 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {/* 가시 브레드크럼 — 각 탭 페이지의 `BreadcrumbList` JSON-LD
                        (`SIGLENS › 종목명 › 탭`)과 같은 마디를 같은 문자열로 그린다. 예전에는
                        같은 줄을 링크·span 나열로만 그려 구조가 없었다. `<ol>`은 기존 줄과 같은
                        flex·gap이라 시각 배치는 그대로다. 홈 마디 텍스트는 JSON-LD와 같은
                        `SITE_NAME`이고 대문자는 CSS(`uppercase`)가 만든다. */}
                    <nav aria-label={breadcrumbLabel} className="min-w-0">
                        <ol className="flex min-w-0 items-center gap-2">
                            {/* 모바일(sm 미만)에서는 "SIGLENS /" 브레드크럼과 영문명을 감춘다.
                                375px에서 이 둘이 폭을 먹어 한국어 종목명이 "애플, App…"처럼
                                잘렸다 — 모바일 헤더에서 사용자가 알아봐야 하는 건 종목명과
                                티커뿐이고, 홈은 사이트 헤더 로고가 이미 가리킨다. */}
                            <li className="hidden sm:inline">
                                <Link
                                    href="/"
                                    // 모든 심볼 페이지의 브레드크럼에 렌더되므로 사실상 전역 링크다.
                                    // 진입 심볼마다 다른 `_rsc` 해시로 `/`의 캐시를 파편화시킨다
                                    // (docs/architecture/CDN_CACHING.md §1).
                                    prefetch={false}
                                    className="font-mono text-xs tracking-[0.2em] text-secondary-400 uppercase transition-colors hover:text-secondary-300"
                                >
                                    {SITE_NAME}
                                </Link>
                            </li>
                            <li
                                aria-hidden="true"
                                className="hidden text-secondary-500 sm:inline"
                            >
                                /
                            </li>
                            {/* 종목 브레드크럼은 5개 sibling 페이지(/[symbol], /news,
                                /fundamental, /options, /overall, /fear-greed)에 공통으로
                                렌더되므로 h1으로 두면 페이지별 sr-only h1과 충돌해 페이지당
                                h1이 2개가 된다. 페이지마다 실제 주제가 다르므로 페이지 h1을
                                살리고, 여기는 시각 스타일만 유지한 채 의미론적 위계에서는
                                제외한다 — 브레드크럼 `<ol>`의 한 마디로만 둔다.

                                모바일은 최대 2줄까지 줄바꿈한다(`line-clamp-2`, text-base) —
                                2줄 높이(40px)가 컨트롤(size-11 = 44px)보다 작아 헤더 높이,
                                곧 `--symbol-chrome-h`는 그대로다. sm 이상은 기존의 한 줄 말줄임. */}
                            <li
                                className="min-w-0"
                                {...(isChartRoute
                                    ? { 'aria-current': 'page' as const }
                                    : {})}
                            >
                                {isChartRoute ? (
                                    <span className={nameClassName}>
                                        {nameContent}
                                    </span>
                                ) : (
                                    <Link
                                        href={`/${ticker}`}
                                        // 하위 탭 하나하나에 렌더되는 헤더 링크 — prefetch는 `_rsc` 해시를
                                        // 탭×진입 경로별로 파편화한다(docs/architecture/CDN_CACHING.md §1).
                                        prefetch={false}
                                        className={cn(
                                            nameClassName,
                                            'transition-colors hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none'
                                        )}
                                    >
                                        {nameContent}
                                    </Link>
                                )}
                            </li>
                            {/* 셋째 마디(현재 탭)는 sm 이상에서만 보인다 — 모바일은 종목명이 폭을
                                다 쓰고(위 SIGLENS 마디와 같은 이유), 바로 아래 탭 레일의 활성 탭이 같은
                                정보를 이미 보여 준다. */}
                            {subTab !== null && (
                                <>
                                    <li
                                        aria-hidden="true"
                                        className="hidden text-secondary-500 sm:inline"
                                    >
                                        /
                                    </li>
                                    <li
                                        aria-current="page"
                                        className="hidden shrink-0 text-sm whitespace-nowrap text-secondary-400 sm:inline"
                                    >
                                        {tabCrumbLabels[subTab]}
                                    </li>
                                </>
                            )}
                        </ol>
                    </nav>
                    {/* 칩은 서버가 계산한 스냅샷을 그대로 렌더하는 순수 컴포넌트다 —
                        훅도 fetch도 없으므로 suspend하거나 throw하지 않는다. 경계를
                        그대로 두는 건 방어용이다: 칩이 어떤 이유로든 터져도 헤더
                        셸(모델 셀렉터·브레드크럼)은 살아남아야 한다.
                        (예전엔 `useBars`가 `useSuspenseQuery` 기반이라 promise를
                        throw하면 부모 트리까지 suspend됐고, 그게 경계의 원래 이유였다.)

                        DUAL MOUNT: 데스크톱에서는 타이틀 옆 인라인, 모바일에서는 별도
                        행에 표시한다. 두 인스턴스 모두 같은 prop을 받으므로 fetch가
                        유발되지 않는다 — mount-time side effect(analytics, ref 등)를
                        추가할 때만 두 번 실행되는 점에 유의한다. */}
                    <ErrorBoundary fallback={null}>
                        <Suspense fallback={null}>
                            <span className="hidden sm:contents">
                                <FearGreedHeaderChip
                                    snapshot={fearGreedSnapshot}
                                />
                            </span>
                        </Suspense>
                    </ErrorBoundary>
                </div>

                {/* 컨트롤 영역. 모델 셀렉터 + 상세분석 토글은 AnalysisSettingsMenu의
                    "⚙ 분석 설정" 팝오버 뒤로 합쳐 헤더 컨트롤 행에서 제거했다(헤더
                    디클러터) — 남는 건 [평단 칩][공유][설정 기어] 3개의 size-11
                    아이콘형 컨트롤뿐이라 모바일도 데스크톱도 단일 행으로 충분하다.
                    이전엔 모바일에서 두 줄(공포·탐욕+공유 / 모델·토글·평단)로 쌓아야
                    했지만, 이제 한 줄에 다 들어가 헤더 높이가 늘어나지 않는다(웹킷
                    회귀 가드 — 탭 내비가 채팅 패널 아래로 밀리지 않도록 헤더가 커지면
                    안 된다는 제약은 여전히 유효하며, 이 변경은 그 제약을 오히려
                    더 여유 있게 만족시킨다). */}
                <div className="flex shrink-0 items-center justify-end gap-2">
                    <ErrorBoundary fallback={null}>
                        <Suspense fallback={null}>
                            <span className="sm:hidden">
                                <FearGreedHeaderChip
                                    snapshot={fearGreedSnapshot}
                                />
                            </span>
                        </Suspense>
                    </ErrorBoundary>
                    <div className="flex items-center gap-2">
                        <PortfolioChipMounted symbol={ticker} />
                        <ShareButton />
                        <AnalysisSettingsMenu
                            modelId={modelId}
                            allowedModels={allowedModels}
                            handleModelChange={handleModelChange}
                            reasoning={reasoning}
                            setReasoning={setReasoning}
                            canUseReasoning={canUseReasoning}
                            isReasoningSupported={isReasoningSupported}
                            openSignupNudge={openSignupNudge}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-3">
                <Suspense fallback={<SymbolTabsSkeleton />}>
                    <SymbolTabs symbol={symbol} />
                </Suspense>
            </div>

            {gateModal !== null && (
                <PremiumModelGateModal
                    mode={gateModal.mode}
                    providerLabel={LLM_PROVIDER_LABELS[gateModal.provider]}
                    onClose={dismissGate}
                />
            )}
            {/* The signup-nudge modal is rendered once by SymbolModelProvider
                (shared with ChartContent's auto-nudge) — not here. */}
        </div>
    );
}
