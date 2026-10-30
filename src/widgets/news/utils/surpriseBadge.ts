/**
 * 실적 서프라이즈 배지 판정 — 실제치와 추정치의 괴리율로 배지 종류와 색을 정한다.
 */
import type { EarningsReportComparisonItem } from '@/shared/lib/types';

const MATERIAL_SURPRISE_PCT = 2;

type SurpriseKind = 'surprise' | 'shock' | 'inline';

/** 배지 종류와 괴리율(%). */
export interface SurpriseBadgeData {
    kind: SurpriseKind;
    percent: number;
}

/** 종류별 배지 색 — 어닝 서프라이즈는 성공색, 쇼크는 위험색, 부합은 중립색. */
export const SURPRISE_BADGE_CLASS: Record<SurpriseKind, string> = {
    surprise: 'border-ui-success/40 bg-ui-success/10 text-ui-success-text',
    shock: 'border-ui-danger/40 bg-ui-danger/10 text-ui-danger-text',
    inline: 'border-secondary-500/40 bg-secondary-700/50 text-secondary-300',
};

function getSurprisePercent(
    actual: number | null,
    estimated: number | null
): number | null {
    if (actual === null || estimated === null || estimated === 0) return null;
    return ((actual - estimated) / Math.abs(estimated)) * 100;
}

function kindForPercent(percent: number): SurpriseKind {
    if (percent >= MATERIAL_SURPRISE_PCT) return 'surprise';
    if (percent <= -MATERIAL_SURPRISE_PCT) return 'shock';
    return 'inline';
}

/** 발표 완료 항목의 서프라이즈 배지. EPS 괴리를 우선하고 없으면 매출 괴리를 쓴다. 예정 항목은 `null`. */
export function getSurpriseBadge(
    item: EarningsReportComparisonItem
): SurpriseBadgeData | null {
    if (item.period === 'future') return null;

    const percent =
        getSurprisePercent(item.epsActual, item.epsEstimated) ??
        getSurprisePercent(item.revenueActual, item.revenueEstimated);
    return percent === null ? null : { kind: kindForPercent(percent), percent };
}
