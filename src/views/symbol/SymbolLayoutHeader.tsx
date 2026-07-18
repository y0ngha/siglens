'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { SymbolTabs } from './SymbolTabs';
import { SymbolTabsSkeleton } from './SymbolTabsSkeleton';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { useSymbolModel } from '@/features/symbol-model';
import { AnalysisSettingsMenu } from '@/widgets/analysis';
import { ShareButton } from '@/widgets/share';
import { FearGreedHeaderChipMounted } from './FearGreedHeaderChipMounted';
import { PremiumModelGateModal } from '@/features/premium-gate';
import { PortfolioChipMounted } from '@/features/portfolio-holding';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';

interface SymbolLayoutHeaderProps {
    /** Ticker from the dynamic route param. Internally upper-cased for the breadcrumb. */
    symbol: string;
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
export function SymbolLayoutHeader({ symbol }: SymbolLayoutHeaderProps) {
    const assetInfo = useAssetInfo(symbol);
    const ticker = symbol.toUpperCase();
    const hasCompanyName = !!assetInfo && assetInfo.name !== ticker;

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

    return (
        <header className="relative z-40 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-center gap-2 sm:flex-1">
                    <Link
                        href="/"
                        className="text-secondary-400 hover:text-secondary-300 font-mono text-xs tracking-[0.2em] uppercase transition-colors"
                    >
                        SIGLENS
                    </Link>
                    <span className="text-secondary-700">/</span>
                    {/* 종목 브레드크럼은 5개 sibling 페이지(/[symbol], /news,
                        /fundamental, /options, /overall, /fear-greed)에 공통으로
                        렌더되므로 h1으로 두면 페이지별 sr-only h1과 충돌해 페이지당
                        h1이 2개가 된다. 페이지마다 실제 주제가 다르므로 페이지 h1을
                        살리고, 여기는 시각 스타일만 유지한 채 의미론적 위계에서는
                        제외한다. role 미부여(plain span)로 두면 layout banner 영역의
                        breadcrumb 정도로 처리되어 의도와 일치한다. */}
                    <span className="text-secondary-100 truncate text-lg font-semibold tracking-wide">
                        {assetInfo?.koreanName && (
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
                    {/* useBars가 useSuspenseQuery 기반이라 promise를 throw하면 부모 트리까지
                        suspend된다. 헤더 chip 로딩이 헤더 전체(모델 셀렉터·브레드크럼) 영역에
                        영향을 주지 않도록 여기서 경계를 잡고, 빈 chip 자리만 잠깐 보이게 한다.
                        DUAL MOUNT: 데스크톱에서는 타이틀 옆 인라인, 모바일에서는 별도 행에 표시한다.
                        두 인스턴스는 동일 React Query 캐시를 공유하므로 fetch는 한 번만 발생하지만,
                        FearGreedHeaderChipMounted에 mount-time side effect(analytics, ref 등)를
                        추가할 때는 두 번 실행되는 점에 유의한다. */}
                    <ErrorBoundary fallback={null}>
                        <Suspense fallback={null}>
                            <span className="hidden sm:contents">
                                <FearGreedHeaderChipMounted
                                    symbol={ticker}
                                    fmpSymbol={assetInfo?.fmpSymbol}
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
                <div className="flex items-center justify-between gap-2 sm:order-3 sm:shrink-0 sm:justify-end">
                    <ErrorBoundary fallback={null}>
                        <Suspense fallback={null}>
                            <span className="sm:hidden">
                                <FearGreedHeaderChipMounted
                                    symbol={ticker}
                                    fmpSymbol={assetInfo?.fmpSymbol}
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

            <div className="-mx-4 mt-3">
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
