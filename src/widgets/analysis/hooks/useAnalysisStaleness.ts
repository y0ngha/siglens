'use client';

/**
 * 분석 결과가 오래됐는지(stale 배너 노출 여부) 판정하는 훅.
 */
import { startTransition, useEffect, useEffectEvent, useState } from 'react';
import type { MarketSessionSpec, Timeframe } from '@y0ngha/siglens-core';
import { isAnalysisStale } from '@/entities/analysis/lib/staleThreshold';

/**
 * 탭이 다시 보이게 될 때마다 `onVisible`을 부른다. 리스너 등록·해제는 훅 본문 밖에 둔다(EF-3).
 * 반환값은 해제 함수다.
 */
function subscribeBecameVisible(onVisible: () => void): () => void {
    const handle = (): void => {
        if (document.visibilityState === 'visible') onVisible();
    };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
}

interface UseAnalysisStalenessInput {
    analyzedAt: string | undefined;
    /** stale 판정 임계값을 정하는 분석 타임프레임. */
    timeframe: Timeframe;
    /**
     * 종목 시장의 정규 세션. 있으면 장이 닫힌 동안 새 봉이 없다는 사실을 반영한다. 없으면
     * 시계 임계값만 쓴다.
     */
    session?: MarketSessionSpec;
    /** false면 판정하지 않는다 — 분석 진행 중이거나 재분석 경로가 없을 때. */
    enabled: boolean;
}

/**
 * `analyzedAt`이 타임프레임 임계값보다 오래됐으면 `true`.
 *
 * SSR/hydration mismatch 방지 — 서버 렌더 시점의 `new Date()`와 클라이언트
 * hydration 시점이 다를 수 있어 현재 시각은 client mount 이후에만 캡처한다(`now`가
 * null인 동안은 `false`). 인터벌 타이머는 두지 않는다 — 다음 render(인터랙션·신규
 * 분석·라우트 변경)나 탭이 다시 보이는 순간(`visibilitychange`)에 갱신된다.
 *
 * useEffectEvent는 deps 없이 최신 값을 읽게 할 뿐 set-state-in-effect 린트를 피하게
 * 하지 않는다(oxlint가 그 본문의 setState도 추적). 린트를 통과시키는 것은
 * startTransition 래핑이다 — 그 콜백 안의 setState는 동기 호출로 취급되지 않는다.
 */
export function useAnalysisStaleness({
    analyzedAt,
    timeframe,
    session,
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

    // 장 마감을 넘겨 열어 둔 탭은 타이머가 없어 `now`가 그대로다. 탭이 다시 보일 때 한 번
    // 다시 잡아, 방치된 사이 마감·시간 경과가 경고에 반영되게 한다. 구독 콜백 안의 setState라
    // 렌더 루프를 만들지 않는다.
    useEffect(() => subscribeBecameVisible(captureNow), []);

    if (!enabled || !analyzedAt || now === null) return false;
    return isAnalysisStale(analyzedAt, timeframe, now, session);
}
