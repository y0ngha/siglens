'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { SymbolTabs } from '@/components/symbol-page/SymbolTabs';
import { SymbolTabsSkeleton } from '@/components/symbol-page/SymbolTabsSkeleton';
import { useAssetInfo } from '@/components/symbol-page/hooks/useAssetInfo';
import { useSymbolModel } from '@/components/symbol-page/SymbolModelContext';
import { ModelSelector } from '@/components/analysis/ModelSelector';
import { FearGreedHeaderChipMounted } from '@/components/symbol-page/FearGreedHeaderChipMounted';
import { PremiumModelGateModal } from '@/components/ui/PremiumModelGateModal';
import { LLM_PROVIDER_LABELS } from '@/lib/llmProviderLabels';

interface SymbolLayoutHeaderProps {
    /** Ticker from the dynamic route param. Internally upper-cased for the breadcrumb. */
    symbol: string;
}

/**
 * Layout-level header rendered on every `/[symbol]/*` page.
 *
 * Contains the page-agnostic UI: SIGLENS logo, ticker breadcrumb, SymbolTabs,
 * and the shared AI model selector so all 4 analysis tabs use the same model.
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
    } = useSymbolModel();

    return (
        <header className="relative z-40 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                    <Link
                        href="/"
                        className="text-secondary-500 hover:text-secondary-300 font-mono text-xs tracking-[0.2em] uppercase transition-colors"
                    >
                        SIGLENS
                    </Link>
                    <span className="text-secondary-700">/</span>
                    <h1 className="text-secondary-100 truncate text-lg font-semibold tracking-wide">
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
                        ({ticker})<span className="sr-only"> 기술적 분석</span>
                    </h1>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {/* useBars가 useSuspenseQuery 기반이라 promise를 throw하면 부모 트리까지
                        suspend된다. 헤더 chip 로딩이 헤더 전체(모델 셀렉터·브레드크럼) 영역에
                        영향을 주지 않도록 여기서 경계를 잡고, 빈 chip 자리만 잠깐 보이게 한다. */}
                    <Suspense fallback={null}>
                        <FearGreedHeaderChipMounted
                            symbol={ticker}
                            fmpSymbol={assetInfo?.fmpSymbol}
                        />
                    </Suspense>
                    <span className="text-secondary-500 text-xs whitespace-nowrap">
                        AI 분석 모델
                    </span>
                    <ModelSelector
                        selectedModel={modelId}
                        onModelChange={handleModelChange}
                        allowedModels={allowedModels}
                        className="w-28 sm:w-32 lg:w-36"
                        showLabel={false}
                        dropdownAlign="right"
                    />
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
        </header>
    );
}
