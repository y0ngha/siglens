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
import { StrikeVolumeChart } from '@/components/options/StrikeVolumeChart';
import { OptionsMetricsRow } from '@/components/options/OptionsMetricsRow';
import { OptionsStaleDataBanner } from '@/components/options/OptionsStaleDataBanner';
import { useOptionsChainMetrics } from '@/components/options/hooks/useOptionsChainMetrics';
import {
    isUsOptionsRegularSession,
    isOpenInterestSnapshotStale,
} from '@/domain/market/session';
import type { OptionsSnapshot, SlotMapping } from '@y0ngha/siglens-core';
import type { OptionsExpirationSelector } from '@/domain/types';

interface OptionsPageClientProps {
    symbol: string;
    companyName: string;
    snapshot: OptionsSnapshot;
    slots: ReadonlyArray<SlotMapping | null>;
}

const isSlotMapping = (s: SlotMapping | null): s is SlotMapping => s !== null;

/**
 * `/[symbol]/options` 페이지의 클라이언트 컨테이너.
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
    const [expirationDate, setExpirationDate] =
        useState<OptionsExpirationSelector>(
            () => slots.find(isSlotMapping)?.expirationDate ?? 'all'
        );
    const { modelId } = useSymbolModel();
    const validSlots = useMemo(() => slots.filter(isSlotMapping), [slots]);
    // 단일 호출로 (chain, metrics)을 산출하고 세 자식에 prop-drill 한다 —
    // 이전엔 OptionsMetricsRow / OpenInterestChart / OptionsChainTable이
    // 각자 pickActiveChain + summarizeChainForLlm을 동일 입력으로 3번
    // 돌렸다. chip 전환 시마다 같은 계산이 세 번 반복되던 비용을 제거한다.
    const chainMetrics = useOptionsChainMetrics(snapshot, expirationDate);
    // isOpenInterestSnapshotStale은 모든 chain × strike를 순회해 OI=0 비율을
    // 산정하므로 chip 전환 등으로 컴포넌트가 리렌더될 때마다 다시 돌면 비용이
    // 든다. snapshot 참조 안정성을 deps로 memoize. `new Date()`는 deps에 들어가지
    // 않는데, 매 호출마다 다른 결과를 낼 수 있지만 사용자가 페이지에 머무는 동안
    // 정규장 boundary를 가로지르는 케이스는 거의 없고, snapshot이 새로 들어오면
    // 자동으로 재평가된다.
    const oiStale = useMemo(
        () =>
            !isUsOptionsRegularSession(new Date()) &&
            isOpenInterestSnapshotStale(snapshot),
        [snapshot]
    );
    const nearestExpiry = snapshot.chains[0]?.expirationDate ?? '';

    return (
        <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
            <ExpirationSelector
                slots={validSlots}
                value={expirationDate}
                onChange={setExpirationDate}
            />

            {oiStale && <OptionsStaleDataBanner />}

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
                metrics={chainMetrics.metrics}
                nearestExpiry={nearestExpiry}
                oiStale={oiStale}
            />

            <OpenInterestChart
                underlyingPrice={snapshot.underlyingPrice}
                chain={chainMetrics.chain}
                metrics={chainMetrics.metrics}
            />

            <StrikeVolumeChart
                underlyingPrice={snapshot.underlyingPrice}
                chain={chainMetrics.chain}
            />

            <OptionsChainTable
                symbol={symbol}
                expirationDate={expirationDate}
                underlyingPrice={snapshot.underlyingPrice}
                chain={chainMetrics.chain}
                metrics={chainMetrics.metrics}
                nearestExpiry={nearestExpiry}
            />

            <CrossLinkCards symbol={symbol} current="options" />
        </main>
    );
}
