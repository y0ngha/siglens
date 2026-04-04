import type { PatternResult, SkillChartDisplay } from '@/domain/types';

export interface VisiblePatternResult extends PatternResult {
    renderConfig: SkillChartDisplay;
}

export const isDetectedAndVisible = (
    p: PatternResult
): p is VisiblePatternResult => p.detected && (p.renderConfig?.show ?? false);
