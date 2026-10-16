/**
 * 차트 헤더 띠 팝오버(`ChartPopoverPanel`)의 `position: fixed` 좌표를 계산하는 순수 함수.
 *
 * 차트 열은 `overflow-hidden`이라(`ChartContent`) 앵커 안의 `absolute` 패널은 열이 좁으면 왼쪽이 잘리고
 * 모바일에서는 아래가 잘리거나 AI 시트 아래에 깔린다. 그래서 패널을 `document.body`로 포털해 뷰포트
 * 좌표로 놓는다 — 트리거 바로 아래에서 시작하고, 오른쪽 끝을 트리거에 맞추되 **뷰포트 안으로 밀어 넣고**,
 * 높이는 뷰포트 아래 끝까지로 제한한다(넘치면 패널 안에서 스크롤).
 */

/** 뷰포트 가장자리와 패널 사이의 최소 여백(px). */
export const POPOVER_VIEWPORT_MARGIN = 8;
/** 트리거와 패널 사이 간격(px) — 예전 `mt-1`. */
export const POPOVER_TRIGGER_GAP = 4;
/** 패널 높이 상한(px) — 예전 `max-h-[28rem]`. */
export const POPOVER_MAX_HEIGHT = 448;
/** 이 폭 이상(= Tailwind `lg`)에서만 `axisInset`을 적용한다. */
export const POPOVER_AXIS_INSET_MIN_VIEWPORT = 1024;

export interface PopoverPlacementInput {
    /** 트리거의 `getBoundingClientRect()` 중 쓰는 값. */
    readonly trigger: { readonly right: number; readonly bottom: number };
    readonly viewport: { readonly width: number; readonly height: number };
    /** 원하는 패널 폭(px). 뷰포트가 좁으면 줄어든다. */
    readonly width: number;
    /** lg 이상에서 오른쪽 끝을 트리거에서 이만큼 왼쪽으로 민다(가격 축 라벨 회피). */
    readonly axisInset?: number;
}

export interface PopoverPlacement {
    readonly top: number;
    readonly left: number;
    readonly width: number;
    readonly maxHeight: number;
}

export function computePopoverPlacement({
    trigger,
    viewport,
    width,
    axisInset = 0,
}: PopoverPlacementInput): PopoverPlacement {
    const margin = POPOVER_VIEWPORT_MARGIN;
    const panelWidth = Math.min(width, viewport.width - margin * 2);
    const inset =
        viewport.width >= POPOVER_AXIS_INSET_MIN_VIEWPORT ? axisInset : 0;
    const left = Math.min(
        Math.max(trigger.right - inset - panelWidth, margin),
        viewport.width - panelWidth - margin
    );
    const top = trigger.bottom + POPOVER_TRIGGER_GAP;
    const available = viewport.height - top - margin;
    return {
        top,
        left,
        width: panelWidth,
        maxHeight: Math.max(Math.min(POPOVER_MAX_HEIGHT, available), 0),
    };
}
