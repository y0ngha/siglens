'use client';

import { useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { CrossLinkCards } from '@/components/symbol-page/CrossLinkCards';
import { useSymbolModel } from '@/components/symbol-page/SymbolModelContext';
import { ExpirationSelector } from '@/components/options/ExpirationSelector';
import { OptionsAiAnalysis } from '@/components/options/OptionsAiAnalysis';
import { OptionsAiAnalysisError } from '@/components/options/OptionsAiAnalysisError';
import { OptionsChainTable } from '@/components/options/OptionsChainTable';
import { OpenInterestChart } from '@/components/options/OpenInterestChart';
import { OptionsMetricsRow } from '@/components/options/OptionsMetricsRow';
import type { OptionsSnapshot, SlotMapping } from '@y0ngha/siglens-core';

interface OptionsPageClientProps {
    symbol: string;
    companyName: string;
    snapshot: OptionsSnapshot;
    slots: ReadonlyArray<SlotMapping | null>;
}

/**
 * `/[symbol]/options` 페이지의 클라이언트 컨테이너. Layout A (AI-first):
 *  만기 chip → AI 분석 카드 → 핵심 지표 4개 → OI 차트 → chain 테이블.
 *
 * AI 분석 카드만 ErrorBoundary로 격리한다. yfinance 데이터 fetch는 RSC에서
 * 끝난 상태이므로 metrics/chart/table은 별도 fallback이 필요 없다.
 */
export function OptionsPageClient({
    symbol,
    companyName,
    snapshot,
    slots,
}: OptionsPageClientProps) {
    const validSlots = useMemo(
        () => slots.filter((s): s is SlotMapping => s !== null),
        [slots]
    );
    const initialExpiry: string | 'all' =
        validSlots[0]?.expirationDate ?? 'all';
    const [expirationDate, setExpirationDate] = useState<string | 'all'>(
        initialExpiry
    );
    const { modelId } = useSymbolModel();

    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
            <ExpirationSelector
                slots={validSlots}
                value={expirationDate}
                onChange={setExpirationDate}
            />

            <ErrorBoundary FallbackComponent={OptionsAiAnalysisError}>
                <OptionsAiAnalysis
                    symbol={symbol}
                    companyName={companyName}
                    expirationDate={expirationDate}
                    modelId={modelId}
                />
            </ErrorBoundary>

            <OptionsMetricsRow
                expirationDate={expirationDate}
                snapshot={snapshot}
            />

            <OpenInterestChart
                expirationDate={expirationDate}
                snapshot={snapshot}
            />

            <OptionsChainTable
                symbol={symbol}
                expirationDate={expirationDate}
                snapshot={snapshot}
            />

            <CrossLinkCards symbol={symbol} current="options" />
        </main>
    );
}
