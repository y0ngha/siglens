'use client';

import { useSyncExternalStore } from 'react';
import { STORAGE_PREFIX } from '../constants';

/** 서버 렌더와 하이드레이션 첫 렌더는 항상 `false` — 마운트 뒤 실제 값으로 바뀐다. */
const getServerSnapshot = (): boolean => false;

/** localStorage에 `siglens.chart.*` 키가 하나라도 있는가. 접근이 막힌 환경은 `false`. */
function scanStoredChartPreferences(): boolean {
    try {
        for (let i = 0; i < window.localStorage.length; i += 1) {
            if (window.localStorage.key(i)?.startsWith(`${STORAGE_PREFIX}.`)) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

/**
 * 스캔 결과 캐시. `getSnapshot`은 렌더마다(그리고 React가 스냅샷 안정성을 검증할 때마다)
 * 불리는데, 그때마다 localStorage 키 전체를 훑으면 키가 많은 브라우저에서 낭비다. 첫 클라이언트
 * 읽기에서 한 번 계산하고, 이후엔 `storage` 이벤트(다른 탭의 변경)에서만 다시 계산한다.
 * 같은 탭에서 설정이 처음 저장되는 경우는 입력(=상호작용)이 이미 게이트를 연다.
 */
let cached: boolean | null = null;

function getSnapshot(): boolean {
    cached ??= scanStoredChartPreferences();
    return cached;
}

function subscribe(onChange: () => void): () => void {
    const handleStorage = (): void => {
        const next = scanStoredChartPreferences();
        if (next === cached) return;
        cached = next;
        onChange();
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
}

/** 테스트 전용 — 캐시를 비워 다음 읽기가 다시 스캔하게 한다. */
export function __resetStoredChartPreferencesCacheForTests(): void {
    cached = null;
}

/**
 * 저장된 차트 설정(오버레이·보조지표 창 on/off, MA 기간 등)이 있는 방문자인가.
 *
 * `useBars`의 seed 복원 재조회(`refetchEnabled`)를 **입력 전에도** 열어야 하는 사람을
 * 가려낸다. 서버 seed는 지표를 rsi·macd·buySellVolume만 남긴 축소판이라(`getSeedBarsStatic`),
 * 이전 방문에서 오버레이를 켜 둔 재방문자는 저장된 설정대로 **첫 페인트부터** 전체 지표가
 * 필요하다 — 첫 마우스 움직임까지 한두 점짜리 시리즈를 보면 안 된다. 크롤러·첫 방문자는
 * 저장소가 비어 있어 `false`이므로 재조회가 미뤄진다.
 *
 * 값이 저장돼 있다는 사실만 본다(켜짐 여부까지 해석하지 않는다) — 보수적으로 일찍 복원하는
 * 쪽이 틀려도 비용은 요청 한 번이고, 개별 오버레이 키를 여기서 다시 해석하면 훅이 늘 때마다
 * 어긋난다.
 */
export function useHasStoredChartPreferences(): boolean {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
