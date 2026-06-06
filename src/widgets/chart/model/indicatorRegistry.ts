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
    | 'statistical'
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
    | 'volumeProfile'
    | 'mfi'
    | 'williamsR'
    | 'connorsRsi'
    | 'cmf'
    | 'bollingerPercentB'
    | 'hurst'
    | 'varianceRatio';

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

/**
 * 카테고리 라벨 — 표시 순서의 단일 소스이기도 하다.
 *
 * `Record<IndicatorCategory, string>` 타입이라 새 카테고리 추가 시 키 누락은
 * 컴파일 에러로 잡힌다. CATEGORY_ORDER를 이 객체에서 파생하므로(별도 배열 X)
 * 정렬 목록에서 카테고리가 조용히 빠지는 일이 없다.
 */
export const CATEGORY_LABELS: Record<IndicatorCategory, string> = {
    trend: '추세',
    momentum: '모멘텀',
    volatility: '변동성',
    volume: '볼륨',
    statistical: '통계',
    smc: 'SMC',
};

/**
 * 카테고리 표시 순서. CATEGORY_LABELS의 키 정의 순서를 따른다(JS 문자열 키는
 * 삽입 순서를 보존). Object.keys는 string[]을 반환하지만 키는 IndicatorCategory
 * 멤버임이 CATEGORY_LABELS 타입으로 보장되므로 안전한 캐스트다.
 */
export const CATEGORY_ORDER: readonly IndicatorCategory[] = Object.keys(
    CATEGORY_LABELS
) as IndicatorCategory[];

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
    { key: 'mfi', label: 'MFI', category: 'momentum', kind: 'pane' },
    {
        key: 'williamsR',
        label: 'Williams %R',
        category: 'momentum',
        kind: 'pane',
    },
    { key: 'connorsRsi', label: 'CRSI', category: 'momentum', kind: 'pane' },
    { key: 'cmf', label: 'CMF', category: 'momentum', kind: 'pane' },
    {
        key: 'bollingerPercentB',
        label: '%B',
        category: 'volatility',
        kind: 'pane',
    },
    { key: 'hurst', label: 'Hurst', category: 'statistical', kind: 'pane' },
    {
        key: 'varianceRatio',
        label: 'VR',
        category: 'statistical',
        kind: 'pane',
    },
];

/**
 * key → meta 조회 맵. StockChart binding 조립에서 사용.
 *
 * `Object.fromEntries`의 반환 타입은 `Record<string, IndicatorMeta>`로 넓어지므로
 * `as` 캐스트가 필요하다. INDICATOR_REGISTRY가 IndicatorKey 멤버를 정확히
 * 선언하므로(누락 시 `key: IndicatorKey` 타입에서 컴파일 에러) 런타임에 빠지는
 * 키가 없어 안전한 캐스트다.
 */
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
