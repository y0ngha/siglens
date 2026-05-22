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
import { OptionsStaleDataBanner } from '@/components/options/OptionsStaleDataBanner';
import { useOptionsChainMetrics } from '@/components/options/hooks/useOptionsChainMetrics';
import { isUsOptionsRegularSession } from '@/domain/market/session';
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
 * Yahoo Finance가 미국 정규장 외 시간(PRE-PRE / POST-POST)에 옵션 quote
 * 필드 — 특히 openInterest — 를 0으로 응답하는 시간대가 있다. 두 신호가
 * 동시에 성립할 때만 stale로 판정한다:
 *
 *   1. ET 기준 정규 거래시간(09:30~16:00 평일)이 아니다 — `isUsOptionsRegularSession`
 *      가 DST를 자동 보정해 EDT/EST 모두 정확히 판정.
 *   2. 모든 chain의 모든 strike OI가 0이다 — 진짜 stale data 시그널.
 *
 * 둘 다 만족할 때만 배너를 띄워, 정규장 중 일시적 0 응답이나 OI는 정상이지만
 * 정규장 외인 경우의 false positive를 막는다.
 */
function hasAllZeroOpenInterest(snapshot: OptionsSnapshot): boolean {
    return snapshot.chains.every(
        c =>
            c.calls.every(x => x.openInterest === 0) &&
            c.puts.every(x => x.openInterest === 0)
    );
}

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
    // hasAllZeroOpenInterest는 모든 chain × strike를 순회하므로 chip 전환 등으로
    // 컴포넌트가 리렌더될 때마다 다시 돌면 비용이 든다. snapshot 참조 안정성을
    // deps로 memoize. isUsOptionsRegularSession()은 deps에 들어가지 않는데,
    // 함수 내부에서 new Date()를 호출해 매 호출마다 다른 결과를 낼 수 있지만
    // 사용자가 페이지에 머무는 동안 정규장 boundary를 가로지르는 케이스는 거의
    // 없고, snapshot이 새로 들어오면 자동으로 재평가된다.
    const oiStale = useMemo(
        () => !isUsOptionsRegularSession() && hasAllZeroOpenInterest(snapshot),
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
            />

            <OpenInterestChart
                underlyingPrice={snapshot.underlyingPrice}
                chain={chainMetrics.chain}
                metrics={chainMetrics.metrics}
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
