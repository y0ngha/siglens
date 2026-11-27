'use client';

import type { MarketSessionSpec, Timeframe } from '@y0ngha/siglens-core';
/**
 * 분석 결과가 오래됐는지(stale 배너 노출 여부) 판정하는 훅.
 */
import { useCallback, useState, useSyncExternalStore } from 'react';
import { isAnalysisStale } from '@/entities/analysis/lib/staleThreshold';

/** 판정 기준 시각을 담는 작은 외부 저장소 — `useSyncExternalStore`가 구독한다. */
interface NowStore {
    subscribe: (onChange: () => void) => () => void;
    /** `key`가 바뀌면(새 분석) 시각을 새로 잡는다. 같은 key로는 같은 `Date` 인스턴스를 돌려준다. */
    getSnapshot: (key: string | undefined) => Date;
}

/**
 * 첫 `getSnapshot` 호출 때 현재 시각을 잡고, 탭이 다시 보이는 순간(`visibilitychange`)에
 * 새로 잡아 구독자에게 알린다. 리스너 등록·해제는 훅 본문 밖에 둔다(EF-3).
 */
function createNowStore(): NowStore {
    let now: Date | null = null;
    let nowKey: string | undefined;
    return {
        subscribe: onChange => {
            const handle = (): void => {
                if (document.visibilityState !== 'visible') return;
                now = new Date();
                onChange();
            };
            document.addEventListener('visibilitychange', handle);
            return () =>
                document.removeEventListener('visibilitychange', handle);
        },
        getSnapshot: key => {
            if (now === null || nowKey !== key) {
                now = new Date();
                nowKey = key;
            }
            return now;
        },
    };
}

/** 서버 렌더·hydration 첫 패스에는 시각이 없다 — 서버 시각은 ISR 캐시 뒤에서 의미가 없다. */
const getServerNow = (): null => null;

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
 * hydration 시점이 다를 수 있어 hydration 첫 패스는 서버 스냅샷(`null`, `false`)으로
 * 맞춘다. 그 뒤(그리고 hydration 없이 클라이언트에서 처음 마운트되는 패널, 예: 새 분석이
 * 도착해 폴백이 실제 분석으로 바뀌는 경우)에는 첫 렌더에서 곧바로 현재 시각을 읽는다.
 * 이전에는 마운트 뒤 effect에서 시각을 잡아 패널이 그려진 다음 프레임에 배너가 끼어들었고,
 * 그 ~60px 밀림이 CLS였다.
 *
 * 시각은 `analyzedAt`이 바뀔 때와 탭이 다시 보이는 순간에 갱신된다.
 * 인터벌 타이머는 두지 않는다.
 */
export function useAnalysisStaleness({
    analyzedAt,
    timeframe,
    session,
    enabled,
}: UseAnalysisStalenessInput): boolean {
    const [store] = useState(createNowStore);
    // `analyzedAt`을 키로 넘겨 새 분석이 도착한 렌더에서 시각을 다시 잡는다.
    const getSnapshot = useCallback(
        () => store.getSnapshot(analyzedAt),
        [store, analyzedAt]
    );
    const now = useSyncExternalStore(
        store.subscribe,
        getSnapshot,
        getServerNow
    );

    if (!enabled || !analyzedAt || now === null) return false;
    return isAnalysisStale(analyzedAt, timeframe, now, session);
}
