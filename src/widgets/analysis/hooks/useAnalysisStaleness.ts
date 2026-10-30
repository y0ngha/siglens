'use client';

/**
 * 분석 결과가 오래됐는지(stale 배너 노출 여부) 판정하는 훅.
 */
import { startTransition, useEffect, useEffectEvent, useState } from 'react';
import type { Timeframe } from '@y0ngha/siglens-core';
import { isAnalysisStale } from '@/entities/analysis/lib/staleThreshold';

interface UseAnalysisStalenessInput {
    analyzedAt: string | undefined;
    /** stale 판정 임계값을 정하는 분석 타임프레임. */
    timeframe: Timeframe;
    /** false면 판정하지 않는다 — 분석 진행 중이거나 재분석 경로가 없을 때. */
    enabled: boolean;
}

/**
 * `analyzedAt`이 타임프레임 임계값보다 오래됐으면 `true`.
 *
 * SSR/hydration mismatch 방지 — 서버 렌더 시점의 `new Date()`와 클라이언트
 * hydration 시점이 다를 수 있어 현재 시각은 client mount 이후에만 캡처한다(`now`가
 * null인 동안은 `false`). 인터벌 타이머는 두지 않는다 — 다음 render(인터랙션·신규
 * 분석·라우트 변경)가 일어나야 갱신된다.
 *
 * useEffectEvent는 deps 없이 최신 값을 읽게 할 뿐 set-state-in-effect 린트를 피하게
 * 하지 않는다(oxlint가 그 본문의 setState도 추적). 린트를 통과시키는 것은
 * startTransition 래핑이다 — 그 콜백 안의 setState는 동기 호출로 취급되지 않는다.
 */
export function useAnalysisStaleness({
    analyzedAt,
    timeframe,
    enabled,
}: UseAnalysisStalenessInput): boolean {
    const [now, setNow] = useState<Date | null>(null);

    const captureNow = useEffectEvent((): void => {
        startTransition(() => {
            setNow(new Date());
        });
    });

    useEffect(() => {
        captureNow();
    }, [analyzedAt]);

    if (!enabled || !analyzedAt || now === null) return false;
    return isAnalysisStale(analyzedAt, timeframe, now);
}
