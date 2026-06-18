import type { NewsImpact } from '@y0ngha/siglens-core';

export const IMPACT_LABEL: Record<NewsImpact, string> = {
    high: '주가 영향 큼',
    medium: '주가 영향 보통',
    low: '주가 영향 작음',
    negligible: '주가 영향 거의 없음',
};

export const IMPACT_CLASS: Record<NewsImpact, string> = {
    high: 'bg-ui-warning/10 text-ui-warning',
    medium: 'bg-primary-500/10 text-primary-400',
    low: 'bg-secondary-700 text-secondary-400',
    negligible: 'bg-secondary-700/50 text-secondary-400',
};

/**
 * Type guard for {@link NewsImpact}. Uses {@link IMPACT_CLASS}
 * (Record<NewsImpact, string>) as the exhaustiveness source — if core adds a
 * new impact level, the IMPACT_CLASS definition fails to compile, preventing
 * silent drift.
 */
export function isNewsImpact(value: unknown): value is NewsImpact {
    return typeof value === 'string' && value in IMPACT_CLASS;
}
