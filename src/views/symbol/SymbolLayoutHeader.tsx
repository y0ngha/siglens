'use client';

import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { SymbolTabs } from './SymbolTabs';
import { SymbolTabsSkeleton } from './SymbolTabsSkeleton';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { shouldShowEnglishName } from '@/entities/ticker';
import { useSymbolModel } from '@/features/symbol-model';
import { AnalysisSettingsMenu } from '@/widgets/analysis';
import { ShareButton } from '@/widgets/share';
import { FearGreedHeaderChip } from './FearGreedHeaderChip';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { PremiumModelGateModal } from '@/features/premium-gate';
import { PortfolioChipMounted } from '@/features/portfolio-holding';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';

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
}: SymbolLayoutHeaderProps) {
    const assetInfo = useAssetInfo(symbol);
    const ticker = symbol.toUpperCase();
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
        openSignupNudge,
    } = useSymbolModel();

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
    return (
        <header className="relative z-40 py-3">
            <div className="flex items-center gap-2 px-4 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Link
                        href="/"
                        // 모든 심볼 페이지의 브레드크럼에 렌더되므로 사실상 전역 링크다.
                        // 진입 심볼마다 다른 `_rsc` 해시로 `/`의 캐시를 파편화시킨다
                        // (docs/architecture/CDN_CACHING.md §1).
                        prefetch={false}
                        className="font-mono text-xs tracking-[0.2em] text-secondary-400 uppercase transition-colors hover:text-secondary-300"
                    >
                        SIGLENS
                    </Link>
                    <span className="text-secondary-500">/</span>
                    {/* 종목 브레드크럼은 5개 sibling 페이지(/[symbol], /news,
                        /fundamental, /options, /overall, /fear-greed)에 공통으로
                        렌더되므로 h1으로 두면 페이지별 sr-only h1과 충돌해 페이지당
                        h1이 2개가 된다. 페이지마다 실제 주제가 다르므로 페이지 h1을
                        살리고, 여기는 시각 스타일만 유지한 채 의미론적 위계에서는
                        제외한다. role 미부여(plain span)로 두면 layout banner 영역의
                        breadcrumb 정도로 처리되어 의도와 일치한다. */}
                    <span className="truncate text-lg font-semibold tracking-wide text-secondary-100">
                        {showKoreanName && (
                            <span className="text-secondary-300">
                                {assetInfo.koreanName}
                                {hasCompanyName ? ', ' : ' '}
                            </span>
                        )}
                        {assetInfo && hasCompanyName && (
                            <span className="text-secondary-200">
                                {assetInfo.name}{' '}
                            </span>
                        )}
                        ({ticker})
                    </span>
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
        </header>
    );
}
