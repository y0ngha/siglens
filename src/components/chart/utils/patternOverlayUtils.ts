import type { IChartApi, ISeriesApi } from 'lightweight-charts';
import type { PatternResult, SkillChartDisplay } from '@/domain/types';

export interface VisiblePatternResult extends PatternResult {
    renderConfig: SkillChartDisplay;
}

export function isDetectedAndVisible(
    p: PatternResult
): p is VisiblePatternResult {
    return p.detected && (p.renderConfig?.show ?? false);
}

export function removeHidden<T>(
    map: Map<string, T>,
    visiblePatterns: Set<string>,
    cleanup: (value: T) => void
): void {
    for (const [name, value] of map.entries()) {
        if (!visiblePatterns.has(name)) {
            cleanup(value);
            map.delete(name);
        }
    }
}

export function removeSeries(
    chart: IChartApi,
    seriesList: ISeriesApi<'Line'>[]
): void {
    for (const s of seriesList) {
        chart.removeSeries(s);
    }
}
