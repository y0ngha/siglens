'use client';

/**
 * 전략 스킬 카드 — 펼치면 구조화 요약(또는 원문 요약)과 가이드 링크를 보여준다.
 */
import type { StrategyResult } from '@y0ngha/siglens-core';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { guidePathForSkill } from '@/shared/lib/guideLinkLookup';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { GuideHintLink } from '../GuideHintLink';
import type { OverlayCardControls } from '../model/types';
import { parseStructuredSummary } from '../utils/parseStructuredSummary';
import { ConfidenceBadge } from './ConfidenceBadge';
import { SkillAccordionCard } from './SkillAccordionCard';
import { StructuredSkillSummary } from './StructuredSkillSummary';

interface StrategyAccordionItemProps {
    strategy: StrategyResult;
    /**
     * 배지를 그릴지. `confidence` 깊이가 잠긴 티어는 `confidenceWeight`가 0으로 마스킹돼 오므로
     * 그 0을 "낮은 점수"로 오표시하지 않게 끈다(`utils/lockedSections.ts`의 `hasLockedConfidence`).
     */
    showConfidence: boolean;
    /** 차트 작도 제어 — 이 항목에 그려지는 작도가 없으면 undefined(버튼 없음). */
    overlay?: OverlayCardControls;
}

export function StrategyAccordionItem({
    strategy,
    showConfidence,
    overlay,
}: StrategyAccordionItemProps) {
    const skillLabel = useSkillLabel();
    const title = skillLabel(strategy.strategyName);
    const sections = parseStructuredSummary(strategy.summary);
    const guidePath = guidePathForSkill(strategy.strategyName);

    return (
        <SkillAccordionCard
            id={strategy.id}
            title={title}
            trend={strategy.trend}
            badge={
                showConfidence ? (
                    <ConfidenceBadge
                        confidenceWeight={strategy.confidenceWeight}
                    />
                ) : undefined
            }
            overlay={overlay}
        >
            {sections !== null ? (
                <StructuredSkillSummary sections={sections} />
            ) : (
                <MarkdownText className="text-xs text-secondary-400">
                    {strategy.summary}
                </MarkdownText>
            )}
            {guidePath !== null && (
                <GuideHintLink href={guidePath} name={title} />
            )}
        </SkillAccordionCard>
    );
}
