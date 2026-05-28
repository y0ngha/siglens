'use client';

import {
    startTransition,
    useEffect,
    useEffectEvent,
    useMemo,
    useState,
} from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { CrossLinkCards, useSymbolModel } from '@/widgets/symbol-page';
import { ExpirationSelector } from './ExpirationSelector';
import { OptionsAiAnalysis } from './OptionsAiAnalysis';
import { OptionsAiAnalysisError } from './OptionsAiAnalysisError';
import { OptionsAiAnalysisStaleNotice } from './OptionsAiAnalysisStaleNotice';
import { OptionsChainTable } from './OptionsChainTable';
import { OpenInterestChart } from './OpenInterestChart';
import { StrikeVolumeChart } from './StrikeVolumeChart';
import { OptionsMetricsRow } from './OptionsMetricsRow';
import { OptionsStaleDataBanner } from './OptionsStaleDataBanner';
import { useOptionsChainMetrics } from './hooks/useOptionsChainMetrics';
import {
    isEtRegularSessionOpen,
    type OptionsSnapshot,
    type SlotMapping,
} from '@y0ngha/siglens-core';
import { isOpenInterestSnapshotStale } from '@/shared/lib/options/openInterestStale';
import type { OptionsExpirationSelector } from '@/shared/lib/types';

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
    // 훅 선언 순서(CONVENTIONS.md / MISTAKES.md §17):
    //   useState/useRef → 사용자 정의 훅 → useMemo/useCallback → derived → handlers → useEffect.
    // useEffectEvent 는 effect 본문의 setState 를 lint-rule(react-hooks/
    // set-state-in-effect)을 만족시키기 위한 stable handler 이므로 "handlers"
    // 구간(useEffect 직전)에 둔다 — `AnalysisPanel.tsx` 의 canonical 위치와
    // 동일.
    const [expirationDate, setExpirationDate] =
        useState<OptionsExpirationSelector>(
            () => slots.find(isSlotMapping)?.expirationDate ?? 'all'
        );
    // oiStale 평가는 client-only.
    //   SSR(또는 initial client render)에서 `new Date()`로 평가하면 정규장
    //   boundary를 가로지르는 사용자에게 서버/클라이언트 결과가 어긋나
    //   hydration mismatch 경고가 발생한다. `now`를 useState(null)로 두고
    //   useEffect로 mount 직후 한 번만 채워 SSR 마크업은 항상 banner 없음
    //   상태로 통일한다. snapshot 참조가 갱신되면 자동으로 재평가된다.
    const [now, setNow] = useState<Date | null>(null);
    const { modelId } = useSymbolModel();
    const validSlots = useMemo(() => slots.filter(isSlotMapping), [slots]);
    // 단일 호출로 (chain, metrics)을 산출하고 세 자식에 prop-drill 한다 —
    // 이전엔 OptionsMetricsRow / OpenInterestChart / OptionsChainTable이
    // 각자 pickActiveChain + summarizeChainForLlm을 동일 입력으로 3번
    // 돌렸다. chip 전환 시마다 같은 계산이 세 번 반복되던 비용을 제거한다.
    const chainMetrics = useOptionsChainMetrics(snapshot, expirationDate);
    const oiStale = useMemo(
        () =>
            now !== null &&
            !isEtRegularSessionOpen(now) &&
            isOpenInterestSnapshotStale(snapshot),
        [now, snapshot]
    );
    const nearestExpiry = snapshot.chains[0]?.expirationDate ?? '';
    // handlers — useEffectEvent 는 stable reference 이므로 deps 에 넣지 않는다
    // (MISTAKES.md Predictability §3). 본문은 startTransition 으로 격리해
    // react-hooks/set-state-in-effect lint rule 을 만족시킨다 (§10).
    const captureNow = useEffectEvent((): void => {
        startTransition(() => {
            setNow(new Date());
        });
    });
    useEffect(() => {
        captureNow();
    }, []);

    return (
        // page.tsx가 이미 <main> landmark로 감싸므로 여기는 일반 컨테이너만.
        // 중첩 <main>은 invalid HTML이고 screen reader landmark navigation을
        // 깬다.
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
            <ExpirationSelector
                slots={validSlots}
                value={expirationDate}
                onChange={setExpirationDate}
            />

            {oiStale && <OptionsStaleDataBanner />}

            {/* OI/호가가 비어 있으면 prompt에 들어가는 핵심 지표(Max Pain,
                P/C, top OI/IV/mid·spread)가 모두 무력화되므로, 분석 호출 자체를
                건너뛰고 안내 카드를 보여준다. ErrorBoundary 분기는 정상
                경로에서만 필요. */}
            {oiStale ? (
                <OptionsAiAnalysisStaleNotice />
            ) : (
                <ErrorBoundary FallbackComponent={OptionsAiAnalysisError}>
                    <OptionsAiAnalysis
                        symbol={symbol}
                        companyName={companyName}
                        expirationDate={expirationDate}
                        modelId={modelId}
                    />
                </ErrorBoundary>
            )}

            <OptionsMetricsRow
                expirationDate={expirationDate}
                metrics={chainMetrics.metrics}
                nearestExpiry={nearestExpiry}
                oiStale={oiStale}
            />

            <div className="space-y-4">
                <OpenInterestChart
                    underlyingPrice={snapshot.underlyingPrice}
                    chain={chainMetrics.chain}
                    metrics={chainMetrics.metrics}
                />

                <StrikeVolumeChart
                    underlyingPrice={snapshot.underlyingPrice}
                    chain={chainMetrics.chain}
                />
            </div>

            <OptionsChainTable
                symbol={symbol}
                expirationDate={expirationDate}
                underlyingPrice={snapshot.underlyingPrice}
                chain={chainMetrics.chain}
                metrics={chainMetrics.metrics}
                nearestExpiry={nearestExpiry}
            />

            <CrossLinkCards symbol={symbol} current="options" />
        </div>
    );
}
