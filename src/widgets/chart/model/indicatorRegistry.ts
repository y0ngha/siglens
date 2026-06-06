/**
 * 차트 보조지표 레지스트리 — 모달 렌더링과 차트 binding 조립의 단일 출처.
 *
 * 새 지표 추가 = INDICATOR_REGISTRY에 한 줄. kind는 차트 렌더 훅 분기/문서화용이며
 * 모달 UI는 kind에 무관하다(체크박스 + 선택적 period 칩으로만 다룸). 따라서 향후
 * 'candle-paint'(elderImpulse)·'zone'(smc) 같은 kind나 'statistical' 카테고리가
 * 추가돼도 IndicatorSettingsModal은 무수정이다. (스펙 §3.1 참조)
 */

export type IndicatorCategory =
    | 'trend'
    | 'momentum'
    | 'volatility'
    | 'volume'
    | 'smc';

export type IndicatorKind = 'overlay' | 'pane';

export type IndicatorKey =
    | 'ma'
    | 'ema'
    | 'ichimoku'
    | 'rsi'
    | 'macd'
    | 'dmi'
    | 'stochastic'
    | 'stochRsi'
    | 'cci'
    | 'bollinger'
    | 'volumeProfile';

export interface IndicatorMeta {
    key: IndicatorKey;
    label: string;
    category: IndicatorCategory;
    kind: IndicatorKind;
    /** MA/EMA처럼 다중 period 선택을 가지는 지표만 true. */
    hasPeriods?: boolean;
}

/**
 * 차트가 한 지표를 렌더/토글하는 데 필요한 모든 것 — 정적 메타 + 동적 상태/콜백.
 * 단순 토글 지표는 onToggle만, period 지표(ma/ema)는 period 관련 필드만 채운다.
 */
export interface IndicatorBinding {
    meta: IndicatorMeta;
    active: boolean;
    onToggle?: () => void;
    availablePeriods?: readonly number[];
    visiblePeriods?: number[];
    onTogglePeriod?: (period: number) => void;
}

export interface IndicatorCategoryGroup {
    category: IndicatorCategory;
    label: string;
    items: IndicatorBinding[];
}

export const CATEGORY_ORDER: readonly IndicatorCategory[] = [
    'trend',
    'momentum',
    'volatility',
    'volume',
    'smc',
];

export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
    trend: '추세',
    momentum: '모멘텀',
    volatility: '변동성',
    volume: '볼륨',
    smc: 'SMC',
};

export const INDICATOR_REGISTRY: readonly IndicatorMeta[] = [
    {
        key: 'ma',
        label: 'MA',
        category: 'trend',
        kind: 'overlay',
        hasPeriods: true,
    },
    {
        key: 'ema',
        label: 'EMA',
        category: 'trend',
        kind: 'overlay',
        hasPeriods: true,
    },
    { key: 'ichimoku', label: 'Ichimoku', category: 'trend', kind: 'overlay' },
    { key: 'rsi', label: 'RSI', category: 'momentum', kind: 'pane' },
    { key: 'macd', label: 'MACD', category: 'momentum', kind: 'pane' },
    { key: 'dmi', label: 'DMI', category: 'momentum', kind: 'pane' },
    { key: 'stochastic', label: 'Stoch', category: 'momentum', kind: 'pane' },
    { key: 'stochRsi', label: 'StochRSI', category: 'momentum', kind: 'pane' },
    { key: 'cci', label: 'CCI', category: 'momentum', kind: 'pane' },
    { key: 'bollinger', label: 'BB', category: 'volatility', kind: 'overlay' },
    { key: 'volumeProfile', label: 'VP', category: 'volume', kind: 'overlay' },
];

/** key → meta 조회 맵. StockChart binding 조립에서 사용. */
export const INDICATOR_META: Record<IndicatorKey, IndicatorMeta> =
    Object.fromEntries(
        INDICATOR_REGISTRY.map(meta => [meta.key, meta])
    ) as Record<IndicatorKey, IndicatorMeta>;

/**
 * binding을 카테고리별로 묶되 CATEGORY_ORDER 순서를 유지하고,
 * 항목이 0개인 카테고리(예: SMC)는 제외한다.
 */
export function groupBindingsByCategory(
    bindings: IndicatorBinding[]
): IndicatorCategoryGroup[] {
    return CATEGORY_ORDER.map(category => ({
        category,
        label: CATEGORY_LABELS[category],
        items: bindings.filter(b => b.meta.category === category),
    })).filter(group => group.items.length > 0);
}
