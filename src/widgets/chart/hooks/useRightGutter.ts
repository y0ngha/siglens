'use client';

/**
 * 레벨선 제목이 마지막 캔들을 덮지 않도록 비울 오른쪽 여백(px)을 재서 소비처에 알리는 훅.
 */
import { useEffect, useMemo, useRef } from 'react';
import {
    levelLabelGutterPx,
    type TextMeasurer,
} from '../utils/levelLabelGutter';

/**
 * 제목은 **강조를 뺀 전체** 목록으로 잰다(`useChartOverlaySpecs.levelTitles`) — hover로 여백이
 * 흔들리지 않게 최대 폭으로 고정한다. 소비처는 이 값을 두 차트의 시간축 `rightOffsetPixels`로
 * 적용한다(`useChartSync.setRightOffsetPixels`).
 */
export function useRightGutter(
    levelTitles: readonly string[],
    measureText: TextMeasurer,
    paneWidthPx: number,
    onRightGutterChange: ((pixels: number) => void) | undefined
): void {
    const callbackRef = useRef(onRightGutterChange);
    useEffect(() => {
        callbackRef.current = onRightGutterChange;
    });

    const rightGutterPx = useMemo(
        () => levelLabelGutterPx(levelTitles, measureText, paneWidthPx),
        [levelTitles, measureText, paneWidthPx]
    );

    useEffect(() => {
        // 부모에 알리는 일은 커밋 뒤에 한다 — 콜백이 부모 상태를 바꾸므로 자식 렌더 중에 부를 수
        // 없다. 콜백은 ref로 읽어 값이 바뀔 때만 다시 부른다.
        // react-doctor-disable-next-line react-doctor/no-pass-data-to-parent
        callbackRef.current?.(rightGutterPx);
    }, [rightGutterPx]);
}
