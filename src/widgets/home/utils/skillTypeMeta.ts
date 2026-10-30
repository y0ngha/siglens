import type { SkillType } from '@y0ngha/siglens-core';

/**
 * 스킬 타입별 표시 메타 — 탭 라벨, 카드 배지 라벨, 배지 색.
 *
 * `Record<SkillType, …>`라서 core에 타입이 추가되면 여기서 컴파일 에러가 나고,
 * 탭 목록(`skillTabs.ts`)이 이 레코드에서 파생되므로 탭도 함께 따라온다.
 * 메시지 키는 정적 추출기가 읽을 수 있도록 리터럴로 적는다.
 */
export interface SkillTypeMeta {
    readonly tabLabelKey: string;
    readonly badgeLabelKey: string;
    readonly badgeClassName: string;
}

/** 타입 → 표시 메타. 키 순서가 탭 노출 순서다. */
export const SKILL_TYPE_META: Record<SkillType, SkillTypeMeta> = {
    indicator_guide: {
        tabLabelKey: 'skillFilter.indicator_guide',
        badgeLabelKey: 'skillBadge.indicator_guide',
        badgeClassName:
            'bg-primary-600/15 text-primary-400 border border-primary-600/30',
    },
    pattern: {
        tabLabelKey: 'skillFilter.pattern',
        badgeLabelKey: 'skillBadge.pattern',
        badgeClassName:
            'bg-ui-danger/10 text-ui-danger-text border border-ui-danger/30',
    },
    strategy: {
        tabLabelKey: 'skillFilter.strategy',
        badgeLabelKey: 'skillBadge.strategy',
        badgeClassName:
            'bg-ui-warning/10 text-ui-warning-text border border-ui-warning/30',
    },
    candlestick: {
        tabLabelKey: 'skillFilter.candlestick',
        badgeLabelKey: 'skillBadge.candlestick',
        badgeClassName:
            'bg-ui-success/10 text-ui-success-text border border-ui-success/30',
    },
    support_resistance: {
        tabLabelKey: 'skillFilter.support_resistance',
        badgeLabelKey: 'skillBadge.support_resistance',
        badgeClassName:
            'bg-secondary-700/30 text-secondary-300 border border-secondary-600/50',
    },
};
