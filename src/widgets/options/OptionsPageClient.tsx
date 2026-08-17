'use client';

import { startTransition, useEffect, useEffectEvent, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import {
    useAnalysisSettingsHydrated,
    useSymbolModel,
} from '@/features/symbol-model';
import { CrossLinkCards } from '@/shared/ui/CrossLinkCards';
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
    /**
     * `true` when the SSR-persistent `<OptionsSnapshotProse>` (rendered by
     * `options/page.tsx` above this component) is already showing the same AI
     * conclusion.
     *
     * Hides the client widget's **view** (`hideView`) and its stale-data notice
     * so summary/perExpiration/signals are not rendered twice — but the widget
     * itself stays mounted, because it is the only caller of
     * `usePublishSymbolChat` on this tab and unmounting it locks the chat input
     * with "분석이 완료된 후 질문할 수 있어요" on exactly the symbols that DO
     * have a finished analysis.
     *
     * So this is no longer a true XOR: it selects which of {prose, live view} is
     * visible, not whether the widget runs. Defaults to `false` so callers that
     * don't pass it keep the live-view behavior.
     */
    hasSnapshotProse?: boolean;
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
    hasSnapshotProse = false,
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
    const { modelId, reasoning } = useSymbolModel();
    const isSettingsHydrated = useAnalysisSettingsHydrated();
    const validSlots = slots.filter(isSlotMapping);
    // 단일 호출로 (chain, metrics)을 산출하고 세 자식에 prop-drill 한다 —
    // 이전엔 OptionsMetricsRow / OpenInterestChart / OptionsChainTable이
    // 각자 pickActiveChain + summarizeChainForLlm을 동일 입력으로 3번
    // 돌렸다. chip 전환 시마다 같은 계산이 세 번 반복되던 비용을 제거한다.
    const chainMetrics = useOptionsChainMetrics(snapshot, expirationDate);
    const oiStale =
        now !== null &&
        !isEtRegularSessionOpen(now) &&
        isOpenInterestSnapshotStale(snapshot);
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
        // audit fix FIX 3: `mx-auto max-w-5xl px-4` 제거 — page.tsx의 <main>이
        // 이미 동일 max-width+px를 적용하고 있어(single source), 이 div가
        // 다시 적용하면 이중 inset(양쪽 16px씩)이 걸려 위(OptionsSnapshotProse
        // 카드)와 폭이 어긋난다. `space-y-6 py-6`만 유지 — 세로 간격/패딩은
        // 이 컨테이너 고유 관심사라 유지한다.
        <div className="space-y-6 py-6">
            <ExpirationSelector
                slots={validSlots}
                value={expirationDate}
                onChange={setExpirationDate}
            />

            {oiStale && <OptionsStaleDataBanner />}

            {/* OptionsAiAnalysis(클라 위젯)와 OptionsSnapshotProse(page.tsx가
                위에 렌더하는 SSR 프로즈)는 같은 AI 결론(summary/perExpiration/
                signals)을 그린다. 둘 다 보이면 사용자·스크린리더에 중복이고
                중복 콘텐츠 SEO 리스크라, 프로즈가 있으면 위젯은 `hideView`로
                **뷰만** 끈다. 마운트는 유지한다 — 이 탭에서 usePublishSymbolChat을
                호출하는 곳이 여기뿐이라, 언마운트하면 완료된 분석이 있는 종목일수록
                챗이 잠긴다.

                OI/호가가 stale하면(정규장 밖 + 스냅샷 stale) 핵심 지표(Max Pain,
                P/C, top OI/IV/mid·spread)가 무력화되므로 그 입력으로 **새** 분석을
                만들지는 않는다. 대신 프로즈가 보이는 상황이면 장중에 만들어둔 캐시가
                있다는 뜻이므로 `cacheOnly`로 그것만 읽어 챗 컨텍스트를 채운다(미스면
                아무것도 만들지 않고 챗은 잠긴 채로 둔다).

                따라서 안내 카드는 "stale인데 보여줄 프로즈도 없는" 경우에만 띄운다.
                ErrorBoundary 분기는 위젯이 실제로 도는 경로에만 필요하다. */}
            {oiStale && !hasSnapshotProse && <OptionsAiAnalysisStaleNotice />}
            {(!oiStale || hasSnapshotProse) && (
                <ErrorBoundary FallbackComponent={OptionsAiAnalysisError}>
                    <OptionsAiAnalysis
                        symbol={symbol}
                        companyName={companyName}
                        expirationDate={expirationDate}
                        modelId={modelId}
                        reasoning={reasoning}
                        isSettingsHydrated={isSettingsHydrated}
                        hideView={hasSnapshotProse}
                        cacheOnly={oiStale}
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
