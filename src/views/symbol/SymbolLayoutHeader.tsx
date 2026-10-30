'use client';

import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { Suspense } from 'react';
import { useSelectedLayoutSegment } from 'next/navigation';
import { ErrorBoundary } from 'react-error-boundary';
import { SymbolTabs } from './SymbolTabs';
import { SymbolTabsSkeleton } from './SymbolTabsSkeleton';
import { useAssetInfo } from '@/entities/ticker/hooks/useAssetInfo';
import { useSymbolModel } from '@/features/symbol-model/model/SymbolModelContext';
import { FearGreedHeaderChip } from './FearGreedHeaderChip';
import type { FearGreedSnapshot } from '@y0ngha/siglens-core';
import { PremiumModelGateModal } from '@/features/premium-gate/ui/PremiumModelGateModal';
import { LLM_PROVIDER_LABELS } from '@/shared/lib/llmProviderLabels';
import {
    subTabOfSegment,
    type SymbolSubTabKey,
} from './utils/symbolTabsConfig';
import { resolveHeaderDisplayName } from './utils/headerDisplayName';
import { SymbolBreadcrumb } from './ui/header/SymbolBreadcrumb';
import { SymbolHeaderControls } from './ui/header/SymbolHeaderControls';

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
 * Layout-level header rendered on every `/[symbol]/*` page.
 *
 * Contains the page-agnostic UI: ticker breadcrumb, fear-greed chip, the header
 * controls (watchlist, holding chip, share, and the shared "분석 설정" gear so all
 * analysis tabs use the same model/reasoning state) and SymbolTabs.
 * Chart-specific controls (TimeframeSelector) live inside the chart page's own
 * scroll-locked container so the layout header stays free of URL reads.
 */
export function SymbolLayoutHeader({
    symbol,
    fearGreedSnapshot,
    breadcrumbLabel,
    tabCrumbLabels,
}: SymbolLayoutHeaderProps) {
    const assetInfo = useAssetInfo(symbol);
    // 차트(`/{T}`)의 세그먼트는 `null`이다. 하위 탭(`/{T}/news` …)에서는 종목명이 차트로
    // 가는 링크가 된다.
    const segment = useSelectedLayoutSegment();
    const locale = useResolvedLocale();
    const symbolModel = useSymbolModel();
    const { gateModal, dismissGate } = symbolModel;

    const ticker = symbol.toUpperCase();
    const subTab = subTabOfSegment(segment);
    const displayName = resolveHeaderDisplayName(assetInfo, ticker, locale);

    /*
     * 상단 크롬(브레드크럼·탭)은 **전폭 `px-4`**로 둔다 — 크롬은 뷰포트에, 본문은 읽기 폭에
     * 맞춘다. 기본 진입 탭인 차트가 제목 줄을 캔버스 좌단에 맞춰 전폭 `px-4`로 그리므로,
     * 크롬에 본문 폭(`symbol-container`)을 걸면 넓은 화면에서 두 줄이 어긋난다.
     * `px-4`는 차트 제목 줄(`SymbolPageClient`의 타임프레임 바)과 같은 값이어야 한다.
     *
     * 최상위 요소는 `<header>`가 아니라 `<div>`다. 이 크롬은 `<main>` 밖에 있어 `<header>`면
     * `banner` 랜드마크가 되는데, 사이트 헤더가 이미 banner라 한 페이지에 banner가 둘이 된다.
     * 안의 브레드크럼 `<nav>`와 탭 `<nav>`가 각자 랜드마크라 이 래퍼에는 역할이 필요 없다.
     */
    return (
        <div className="relative z-40 py-3">
            <div className="flex items-center gap-2 px-4 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    <SymbolBreadcrumb
                        label={breadcrumbLabel}
                        ticker={ticker}
                        name={displayName}
                        isChartRoute={segment === null}
                        subTabLabel={
                            subTab === null ? null : tabCrumbLabels[subTab]
                        }
                        locale={locale}
                    />
                    {/* 칩은 서버가 계산한 스냅샷을 그대로 렌더하는 순수 컴포넌트라 suspend하거나
                        throw하지 않는다. 경계는 방어용이다: 칩이 어떤 이유로든 터져도 헤더
                        셸(컨트롤·브레드크럼)은 살아남아야 한다.

                        DUAL MOUNT: 데스크톱에서는 타이틀 옆 인라인, 모바일에서는 컨트롤
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
                    <SymbolHeaderControls
                        ticker={ticker}
                        watchlistLabel={displayName.watchlistLabel}
                        settings={symbolModel}
                    />
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
                    access={gateModal.access}
                    onClose={dismissGate}
                />
            )}
            {/* The signup-nudge modal is rendered once by SymbolModelProvider
                (shared with ChartContent's auto-nudge) — not here. */}
        </div>
    );
}
