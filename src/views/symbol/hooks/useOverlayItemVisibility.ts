'use client';

import { useCallback, useState } from 'react';

const EMPTY_KEYS: ReadonlySet<string> = new Set();

interface UseOverlayItemVisibilityReturn {
    /** 꺼진 항목 key(`overlayItemKey`·`ACTION_PRICES_ITEM_KEY`). 비어 있으면 전부 켜짐. */
    hiddenKeys: ReadonlySet<string>;
    /** AI 패널 카드 hover·focus로 강조 중인 항목 key. */
    highlightedKey: string | null;
    setVisible: (keys: readonly string[], visible: boolean) => void;
    setHighlighted: (key: string | null) => void;
    /** `key`가 강조 중일 때만 해제한다(멱등) — 카드 언마운트 정리 전용. */
    clearHighlighted: (key: string) => void;
}

/**
 * 차트 작도 on/off 상태 — 차트 헤더 메뉴와 AI 패널 버튼이 **같은 상태**를 쓴다.
 *
 * 저장하지 않는다(설계 2026-09-29): 항목(상승 쐐기, 추세선 #1 …)은 분석마다 달라
 * 이전 분석의 선택을 이어받을 대상이 없다. `resetKey`가 바뀌면(호출부가 종목·
 * 타임프레임·`analyzedAt`을 묶어 넘긴다) 전부 켜진 기본 상태로 돌아간다. 타임프레임을
 * 명시적으로 키에 넣는 이유: `ChartContent`는 타임프레임 전환에 재마운트되지 않고,
 * 지금은 `useAnalysis`가 전환 시 결과를 비워 `analyzedAt`이 우연히 바뀔 뿐이다 — 그
 * 동작에 기대면 전환 중 이전 결과를 유지하도록 바꾸는 순간 꺼진 항목이 새
 * 타임프레임으로 샌다.
 *
 * 초기화는 effect가 아니라 렌더 중 이전 값 비교로 한다(REACT.md#EF-1) — effect로
 * 하면 새 분석의 첫 페인트가 이전 분석의 꺼진 key를 한 번 들고 그려진다.
 */
export function useOverlayItemVisibility(
    resetKey: string
): UseOverlayItemVisibilityReturn {
    const [hiddenKeys, setHiddenKeys] =
        useState<ReadonlySet<string>>(EMPTY_KEYS);
    const [highlightedKey, setHighlightedKey] = useState<string | null>(null);
    const [prevResetKey, setPrevResetKey] = useState(resetKey);
    if (prevResetKey !== resetKey) {
        setPrevResetKey(resetKey);
        setHiddenKeys(EMPTY_KEYS);
        setHighlightedKey(null);
    }

    const setVisible = useCallback(
        (keys: readonly string[], visible: boolean) => {
            setHiddenKeys(
                prev =>
                    new Set(
                        visible
                            ? [...prev].filter(key => !keys.includes(key))
                            : [...prev, ...keys]
                    )
            );
        },
        []
    );

    const clearHighlighted = useCallback((key: string) => {
        setHighlightedKey(prev => (prev === key ? null : prev));
    }, []);

    return {
        hiddenKeys,
        highlightedKey,
        setVisible,
        setHighlighted: setHighlightedKey,
        clearHighlighted,
    };
}
