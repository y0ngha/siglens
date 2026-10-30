/**
 * 재무 건전성 지표(Altman Z·Piotroski F)의 구간 → 배지 매핑.
 */
import type { EnumLabelTranslator } from '@/shared/lib/enumLabelTranslator';

/** 배지 색조. */
export type BadgeVariant = 'good' | 'warn' | 'bad' | 'neutral';

/** 지표 값 옆에 붙는 배지. */
export interface HealthBadge {
    text: string;
    variant: BadgeVariant;
}

/**
 * Altman Z-Score 구간 → 배지. `financialHealthZone.*` 카탈로그 키를 쓴다
 * (신규 그룹 — 값 자체가 riskLevel/기존 그룹 어디와도 겹치지 않는다).
 */
export function altmanBadge(
    z: number | null,
    t: EnumLabelTranslator
): HealthBadge | undefined {
    if (z === null) return undefined;
    if (z > 2.99) {
        return { text: t('financialHealthZone.safe'), variant: 'good' };
    }
    if (z > 1.81) {
        return { text: t('financialHealthZone.caution'), variant: 'warn' };
    }
    return { text: t('financialHealthZone.danger'), variant: 'bad' };
}

/**
 * Piotroski F-Score 구간 → 배지. 중간 구간("보통")은 `riskLevel.medium`을
 * 재사용한다 — 값이 이미 riskLevel 그룹과 같아 새 키를 또 만들지 않는다.
 */
export function piotroskiBadge(
    p: number | null,
    t: EnumLabelTranslator
): HealthBadge | undefined {
    if (p === null) return undefined;
    if (p >= 8) {
        return { text: t('financialHealthZone.strong'), variant: 'good' };
    }
    if (p >= 5) return { text: t('riskLevel.medium'), variant: 'neutral' };
    return { text: t('financialHealthZone.weak'), variant: 'bad' };
}
