import type { ChartOverlay, OverlayKind } from '@y0ngha/siglens-core';
import {
    firstSegmentDirection,
    isOverlayDrawn,
    overlayItemKey,
    type SegmentDirection,
} from './chartOverlayUtils';

/**
 * 매매 가격선(진입·청산·손절) 항목의 key. 작도 key(core의 sourceRef·overlay id —
 * `double_bottom_0`, `pattern:…`, `tl:…` 꼴)와 같은 문자열 공간을 쓰므로 core가 절대
 * 만들지 않는 `ui:` 접두사로 분리한다.
 */
export const ACTION_PRICES_ITEM_KEY = 'ui:action-prices';

/** 메뉴 그룹 순서 — 매매 가격선이 맨 위, 그다음 core `OverlayKind` 순서. */
export type OverlayMenuGroupKind = 'action' | OverlayKind;

export type OverlayMenuItem =
    | { key: string; kind: Exclude<OverlayKind, 'trendline'>; label: string }
    | {
          key: string;
          kind: 'trendline';
          direction: 'up' | 'down';
          /** 방향별 1부터 시작하는 번호("상승 추세선 #1"). */
          index: number;
      }
    | { key: typeof ACTION_PRICES_ITEM_KEY; kind: 'action' };

interface BuildOverlayMenuItemsOptions {
    barTimes: ReadonlySet<number>;
    lastBarTime: number;
    /** 패턴·전략 카드 제목(sourceRef → 스킬명). 없으면 sourceRef를 그대로 쓴다. */
    labelFor: (sourceRef: string) => string | undefined;
    hasActionPrices: boolean;
}

/**
 * 메뉴·패널에 띄울 on/off 항목 목록. 지금 봉 위에 실제로 선이 그려지는 작도만
 * 넣는다(`isOverlayDrawn`) — 눌러도 아무것도 안 보이는 스위치를 만들지 않는다.
 */
export function buildOverlayMenuItems(
    overlays: readonly ChartOverlay[],
    {
        barTimes,
        lastBarTime,
        labelFor,
        hasActionPrices,
    }: BuildOverlayMenuItemsOptions
): OverlayMenuItem[] {
    const drawn = overlays.filter(o =>
        isOverlayDrawn(o, barTimes, lastBarTime)
    );
    const seen = new Set<string>();
    const unique = drawn.filter(o => {
        const key = overlayItemKey(o);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const trendlines = unique.filter(o => o.kind === 'trendline');
    const trendItems = (['up', 'down'] as const).flatMap(direction =>
        trendlines
            .filter(o => trendlineDirection(o) === direction)
            .map((o, i): OverlayMenuItem => ({
                key: overlayItemKey(o),
                kind: 'trendline',
                direction,
                index: i + 1,
            }))
    );
    const cardItems = unique.flatMap((o): OverlayMenuItem[] =>
        o.kind === 'trendline'
            ? []
            : [
                  {
                      key: o.sourceRef,
                      kind: o.kind,
                      label: labelFor(o.sourceRef) ?? o.sourceRef,
                  },
              ]
    );
    const actionItems: OverlayMenuItem[] = hasActionPrices
        ? [{ key: ACTION_PRICES_ITEM_KEY, kind: 'action' }]
        : [];

    return [...actionItems, ...cardItems, ...trendItems];
}

/** 추세선 방향 — 선분이 없으면(그려지지 않으므로 실제론 없음) 상승으로 센다. */
function trendlineDirection(overlay: ChartOverlay): SegmentDirection {
    return firstSegmentDirection(overlay.segments) ?? 'up';
}

/**
 * 패턴 항목 key(`sourceRef`) → 메뉴 라벨(로케일 스킬명). 패턴 돌파선 라벨에 어느 패턴의
 * 선인지 붙이는 데 쓴다 — 패턴이 둘 이상 켜지면 "돌파 기준"만으로는 구분이 안 된다.
 */
export function patternLabelsByKey(
    items: readonly OverlayMenuItem[]
): ReadonlyMap<string, string> {
    return new Map(
        items.flatMap(item =>
            item.kind === 'pattern' ? [[item.key, item.label] as const] : []
        )
    );
}
