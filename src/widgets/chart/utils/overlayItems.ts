import {
    STRATEGY_KIND_SOURCE_REF,
    type ChartOverlay,
    type OverlayKind,
    type StrategyOverlayKind,
} from '@y0ngha/siglens-core';
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
    | {
          key: string;
          kind: Exclude<OverlayKind, 'trendline'>;
          /** 근거 카드 이름(로케일 스킬명). */
          label: string;
      }
    | {
          key: string;
          kind: StrategyOverlayKind;
          /**
           * 카드가 없는 종류 항목 — core가 어느 카드도 소유하지 않는 피보나치·
           * 다이버전스·엘리어트를 `STRATEGY_KIND_SOURCE_REF[kind]` 밑에 그렸다는
           * 뜻이라, 메뉴는 종류 이름으로 표시한다.
           */
          label: null;
      }
    | {
          key: string;
          kind: 'trendline';
          direction: 'up' | 'down';
          /** 방향별 1부터 시작하는 번호("상승 추세선 #1"). */
          index: number;
      }
    | { key: typeof ACTION_PRICES_ITEM_KEY; kind: 'action' };

/** core가 카드 없이 종류로 그린 작도의 `sourceRef` 값들. */
const KIND_SOURCE_REFS: ReadonlySet<string> = new Set(
    Object.values(STRATEGY_KIND_SOURCE_REF)
);
const isKindSourceRef = (sourceRef: string): boolean =>
    KIND_SOURCE_REFS.has(sourceRef);

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
    const cardItems = unique.flatMap((o): OverlayMenuItem[] => {
        if (o.kind === 'trendline') return [];
        // 패턴은 항상 카드가 소유한다(core는 전략 종류만 `kind:*`로 옮긴다) —
        // `pattern` 제외는 그 사실을 타입에 반영해 kind 변형을 좁히는 것.
        if (isKindSourceRef(o.sourceRef) && o.kind !== 'pattern')
            return [{ key: o.sourceRef, kind: o.kind, label: null }];
        return [
            {
                key: o.sourceRef,
                kind: o.kind,
                label: labelFor(o.sourceRef) ?? o.sourceRef,
            },
        ];
    });
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

/**
 * 패턴 항목 key → 팔레트 색. 패턴이 **둘 이상**일 때만 채운다 — 스킬 색은 상승/하락/
 * 중립 3색뿐이라 같은 방향 패턴끼리 선이 겹쳐 구분되지 않았다(2026-10-02 렌더 점검).
 * 하나뿐이면 빈 맵을 돌려 스킬 색(방향 의미)을 그대로 쓴다. 메뉴 순서대로 팔레트를
 * 돌아 쓴다.
 */
export function patternPaletteByKey(
    items: readonly OverlayMenuItem[],
    palette: readonly string[]
): ReadonlyMap<string, string> {
    const patterns = items.filter(item => item.kind === 'pattern');
    if (patterns.length < 2 || palette.length === 0) return new Map();
    return new Map(
        patterns.map((item, i) => [item.key, palette[i % palette.length]])
    );
}

/** 켜진 작도가 이 수 이하면 무효화·목표 축 라벨을 전부 띄운다. 넘으면 강조한 작도 것만. */
export const MAX_OVERLAYS_WITH_OUTCOME_LABELS = 2;

/** 무효화·목표·5파 상한 선을 내는 작도 종류 — core는 패턴과 엘리어트에만 싣는다. */
const OUTCOME_LEVEL_KINDS: ReadonlySet<OverlayMenuGroupKind> = new Set([
    'pattern',
    'elliott',
]);

/**
 * 결과선(무효화·목표)을 내는 켜진 작도가 MAX_OVERLAYS_WITH_OUTCOME_LABELS를 넘는가 —
 * 넘으면 그 축 라벨을 강조한 작도 것만 띄운다. 작도 8개에서 라벨이 20개 넘게 쌓여
 * 서로 가렸다(2026-10-02 렌더 점검). 추세선·피보나치·다이버전스는 결과선이 없으니
 * 세지 않는다. 선은 늘 그린다.
 */
export function areOutcomeLabelsCrowded(
    items: readonly OverlayMenuItem[],
    hiddenKeys: ReadonlySet<string>
): boolean {
    return (
        items.filter(
            item =>
                OUTCOME_LEVEL_KINDS.has(item.kind) && !hiddenKeys.has(item.key)
        ).length > MAX_OVERLAYS_WITH_OUTCOME_LABELS
    );
}
