import type {
    ChartOverlay,
    OverlayKind,
    OverlayLabel,
    OverlayLevel,
    OverlayPoint,
    OverlaySegment,
} from '@y0ngha/siglens-core';
import { isPlainRecord } from '@/shared/lib/isPlainRecord';

/**
 * 저장된 분석 결과(`analysis_history.result`, jsonb)에서 차트에 그릴 수 있는 작도만 꺼낸 것.
 * SIGLENS AI의 차트 블록(`chartBlockFrom`)이 읽는 필드와 같다 — 작도 목록, 패턴별 색, 카드 이름.
 */
export interface ChartDrawingSource {
    overlays: ChartOverlay[];
    /** `patternSummaries[].id → renderConfig.color`. */
    overlayColors: Record<string, string>;
    /** 카드 id(`patternSummaries[].id`·`strategyResults[].id`) → 스킬 원래 이름. */
    overlayLabels: Record<string, string>;
}

const KINDS: Record<OverlayKind, true> = {
    pattern: true,
    trendline: true,
    divergence: true,
    fibonacci: true,
    elliott: true,
};

const isKind = (value: unknown): value is OverlayKind =>
    typeof value === 'string' && Object.hasOwn(KINDS, value);

/** 메일 HTML·이미지에 그대로 쓰는 값이라 16진 색만 받는다. */
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

const isNum = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

function narrowPoint(value: unknown): OverlayPoint | null {
    if (!isPlainRecord(value)) return null;
    const { time, price } = value;
    return isNum(time) && isNum(price) ? { time, price } : null;
}

function narrowSegment(value: unknown): OverlaySegment | null {
    if (!isPlainRecord(value)) return null;
    const from = narrowPoint(value.from);
    const to = narrowPoint(value.to);
    const { role, style, pane } = value;
    if (from === null || to === null || typeof role !== 'string') return null;
    if (style !== 'solid' && style !== 'dashed') return null;
    if (pane !== 'price' && pane !== 'rsi') return null;
    return { from, to, role, style, pane };
}

function narrowLevel(value: unknown): OverlayLevel | null {
    if (!isPlainRecord(value)) return null;
    const { price, fromTime, label } = value;
    return isNum(price) && isNum(fromTime) && typeof label === 'string'
        ? { price, fromTime, label }
        : null;
}

function narrowLabel(value: unknown): OverlayLabel | null {
    if (!isPlainRecord(value)) return null;
    const at = narrowPoint(value.at);
    const { text, position } = value;
    if (at === null || typeof text !== 'string') return null;
    if (position !== 'above' && position !== 'below') return null;
    return { at, text, position };
}

/** 배열의 모든 원소가 `narrow`를 통과할 때만 그 결과 배열, 하나라도 깨졌으면 `null`. */
function narrowAll<T>(
    value: unknown,
    narrow: (item: unknown) => T | null
): T[] | null {
    if (!Array.isArray(value)) return null;
    const items = value.flatMap(item => {
        const narrowed = narrow(item);
        return narrowed === null ? [] : [narrowed];
    });
    return items.length === value.length ? items : null;
}

function narrowOverlay(value: unknown): ChartOverlay | null {
    if (!isPlainRecord(value)) return null;
    const { id, kind, skill, sourceRef, variant } = value;
    if (
        typeof id !== 'string' ||
        !isKind(kind) ||
        typeof skill !== 'string' ||
        typeof sourceRef !== 'string' ||
        (variant !== 'primary' && variant !== 'alternate')
    )
        return null;
    const segments = narrowAll(value.segments, narrowSegment);
    const levels = narrowAll(value.levels, narrowLevel);
    const labels = narrowAll(value.labels, narrowLabel);
    if (segments === null || levels === null || labels === null) return null;
    return { id, kind, skill, sourceRef, variant, segments, levels, labels };
}

function recordList(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.filter(isPlainRecord) : [];
}

/**
 * `analysis_history.result`에서 작도를 좁힌다. 깨진 작도는 그것만 버리고(전체를 버리지 않는다), 그릴 작도가 하나도
 * 남지 않으면 `null`이다. 작도가 없는 옛 결과(`chartOverlays` 부재)도 `null`이다.
 */
export function narrowChartDrawings(
    result: unknown
): ChartDrawingSource | null {
    if (!isPlainRecord(result) || !Array.isArray(result.chartOverlays))
        return null;
    const overlays = result.chartOverlays.flatMap(item => {
        const overlay = narrowOverlay(item);
        return overlay === null ? [] : [overlay];
    });
    if (overlays.length === 0) return null;

    const patterns = recordList(result.patternSummaries);
    const strategies = recordList(result.strategyResults);
    const overlayColors = Object.fromEntries(
        patterns.flatMap(p => {
            const color = isPlainRecord(p.renderConfig)
                ? p.renderConfig.color
                : undefined;
            return typeof p.id === 'string' &&
                typeof color === 'string' &&
                HEX_COLOR.test(color)
                ? [[p.id, color]]
                : [];
        })
    );
    const overlayLabels = Object.fromEntries([
        ...patterns.flatMap(p =>
            typeof p.id === 'string' && typeof p.skillName === 'string'
                ? [[p.id, p.skillName]]
                : []
        ),
        ...strategies.flatMap(s =>
            typeof s.id === 'string' && typeof s.strategyName === 'string'
                ? [[s.id, s.strategyName]]
                : []
        ),
    ]);
    return { overlays, overlayColors, overlayLabels };
}
