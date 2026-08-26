import type { OverlayLegendItem } from '../types';
import { formatOverlayValue, type OverlayGroup } from './overlayLegendFormat';

/**
 * 오버레이 범례의 **기하 계산**. DOM을 재지 않고 순수 산술로만 배치를 정한다.
 *
 * 왜 측정이 아니라 추정인가: 범례 값은 크로스헤어가 움직일 때마다 바뀐다.
 * 매 이동마다 자식 `offsetTop`을 읽으면 60fps로 강제 리플로우가 걸리고,
 * jsdom에는 레이아웃이 없어 그 코드는 테스트로 붙들 수도 없다. 고정폭 글꼴이라
 * 글자 수만으로 폭이 결정되므로 산술로 충분하다.
 *
 * **추정 오차의 방향을 고정한다.** 글자 폭을 실제보다 **크게** 잡으면 한 줄에
 * 덜 넣게 되어 여백이 남는 쪽으로 틀린다. 작게 잡으면 넘친 항목이 `overflow-hidden`에
 * 조용히 잘려 "+N"이 거짓말을 하게 된다. 그래서 아래 상수들은 전부 넉넉한 쪽이다.
 */

/** 한 줄 높이 = `text-[11px] leading-none`(11px) + `gap-y-1.5`(6px). */
export const LEGEND_ROW_HEIGHT_PX = 17;

/**
 * `gap-x-3` — 같은 줄 항목 사이 간격.
 *
 * `LEGEND_ROW_HEIGHT_PX`와 같은 이유로 내보낸다. 이 값들은 실제 CSS를 **작지
 * 않게** 옮겨 적은 것이라, 줄이면 넘친 항목이 조용히 잘린다. 테스트가 그
 * 방향을 붙들 수 있어야 한다(`overlayLegendLayout.test.ts`).
 */
export const ITEM_GAP_PX = 12;

/** 11px 고정폭 글꼴의 글자 전진폭. 통상 0.6em(6.6px)이지만 넉넉히 7로 잡는다. */
const CHAR_WIDTH_PX = 7;

/** `● ` 접두와 이름·값 사이 공백 몫. */
const DOT_AND_SPACES = 3;

/** `+12` 칩과 앞 간격. 줄마다 미리 빼 두면 칩이 어느 줄에 붙어도 넘치지 않는다. */
export const MORE_CHIP_PX = 44;

/** 범례 상자의 `top-2` / `left-2` 인셋. */
const INSET_PX = 8;

/** `py-1` 위아래 합. */
const PAD_Y_PX = 8;

/** `px-1.5` 좌우 합. */
const PAD_X_PX = 12;

/**
 * 오른쪽에서 비워 둘 폭. 보조지표 톱니바퀴가 `right-14`(56px) 위치에
 * `h-11 w-11`(44px)로 놓이므로 오른쪽 끝에서 100px까지가 버튼 영역이고,
 * 그 아래 띠는 가격 축 라벨이 차지한다. 4px 여유를 더해 104px.
 */
const RIGHT_RESERVE_PX = 104;

/**
 * 아직 pane을 재지 못한 상태(첫 페인트·SSR·jsdom)에서는 제한을 걸지 않는다.
 * 0을 "높이 0"으로 해석하면 마운트 직후 한 프레임 동안 범례가 통째로
 * `+33`으로 접혔다가 펴져 깜빡인다.
 */
const UNMEASURED = Number.POSITIVE_INFINITY;

export interface PackedLegend {
    /** 실제로 그릴 줄들. 각 줄은 왼쪽부터의 항목 목록이다. */
    rows: OverlayLegendItem[][];
    /** 자리가 없어 접힌 항목 수. 0보다 크면 `+N` 칩을 띄운다. */
    hiddenCount: number;
}

interface PackParams {
    groups: readonly OverlayGroup[];
    decimals: number;
    maxWidthPx: number;
    maxRows: number;
}

/** 항목 하나가 차지하는 가로 폭(px). `● MA(120) 281.90` 형태를 글자 수로 센다. */
export function legendItemWidthPx(
    item: OverlayLegendItem,
    decimals: number
): number {
    const value = formatOverlayValue(item.value, decimals);
    return (DOT_AND_SPACES + item.name.length + value.length) * CHAR_WIDTH_PX;
}

/**
 * 가격 pane 높이에서 범례가 쓸 수 있는 줄 수.
 *
 * 인셋(위아래 8px)과 상자 패딩을 뺀 나머지를 줄 높이로 나눈다. 최소 1줄은
 * 보장한다 — 0줄이면 `+33` 칩만 남아 같은 높이를 쓰면서 정보만 사라진다.
 */
export function legendMaxRows(pricePaneHeightPx: number): number {
    if (!(pricePaneHeightPx > 0)) return UNMEASURED;
    const budget = pricePaneHeightPx - INSET_PX * 2 - PAD_Y_PX;
    return Math.max(1, Math.floor(budget / LEGEND_ROW_HEIGHT_PX));
}

/** 범례 한 줄이 쓸 수 있는 가로 폭. 톱니바퀴·가격 축 자리를 비워 둔다. */
export function legendMaxWidthPx(chartWidthPx: number): number {
    if (!(chartWidthPx > 0)) return UNMEASURED;
    return Math.max(0, chartWidthPx - INSET_PX - RIGHT_RESERVE_PX - PAD_X_PX);
}

/**
 * 범례 상자의 하드 상한. 줄 수 계산이 어긋나도 이 값이 있으면
 * `overflow-hidden`이 가격 pane 밖으로 나가는 것을 막는다.
 * 잴 수 없으면 `undefined` — 인라인 스타일을 아예 붙이지 않는다.
 */
export function legendMaxHeightPx(
    pricePaneHeightPx: number
): number | undefined {
    if (!(pricePaneHeightPx > 0)) return undefined;
    return Math.max(LEGEND_ROW_HEIGHT_PX, pricePaneHeightPx - INSET_PX * 2);
}

/**
 * 그룹을 줄 단위로 채운다.
 *
 * - 그룹은 **항상 새 줄에서 시작**한다. MA·EMA·BB 계열이 한 덩어리로 읽히는
 *   기존 배치를 유지하기 위해서다.
 * - 줄 예산에서 `+N` 칩 폭을 미리 빼 둔다. 칩이 마지막 줄 끝에 붙어도 넘치지 않는다.
 * - `maxRows`를 넘는 줄은 버리고 그 안의 항목 수를 `hiddenCount`로 돌려준다.
 *   **버린 항목이 조용히 사라지지 않도록** 호출부가 이 수를 반드시 표시한다.
 */
export function packOverlayLegend({
    groups,
    decimals,
    maxWidthPx,
    maxRows,
}: PackParams): PackedLegend {
    const budget = Number.isFinite(maxWidthPx)
        ? maxWidthPx - MORE_CHIP_PX
        : UNMEASURED;

    const rows: OverlayLegendItem[][] = [];

    for (const group of groups) {
        let row: OverlayLegendItem[] = [];
        let used = 0;

        for (const item of group.items) {
            const width = legendItemWidthPx(item, decimals);
            if (row.length > 0 && used + ITEM_GAP_PX + width > budget) {
                rows.push(row);
                row = [];
                used = 0;
            }
            used += (row.length > 0 ? ITEM_GAP_PX : 0) + width;
            row.push(item);
        }

        if (row.length > 0) rows.push(row);
    }

    if (rows.length <= maxRows) return { rows, hiddenCount: 0 };

    const visible = rows.slice(0, maxRows);
    const hiddenCount = rows
        .slice(maxRows)
        .reduce((total, dropped) => total + dropped.length, 0);

    return { rows: visible, hiddenCount };
}
