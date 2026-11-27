'use client';

/**
 * 전략 스킬 카드 — 펼치면 구조화 요약(또는 원문 요약)과 가이드 링크를 보여준다.
 */
import type { StrategyResult } from '@y0ngha/siglens-core';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { guidePathForSkill } from '@/shared/lib/guideLinkLookup';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { GuideHintLink } from '../GuideHintLink';
import { useReadingRenderContext } from '../hooks/useReadingRenderContext';
import type { OverlayCardControls } from '../model/types';
import { parseStructuredSummary } from '../utils/parseStructuredSummary';
import { renderCycleReading } from '../utils/renderIndicatorReading';
import { CycleReadingSummary } from './CycleReadingSummary';
import { SkillAccordionCard } from './SkillAccordionCard';
import { StructuredSkillSummary } from './StructuredSkillSummary';

interface StrategyAccordionItemProps {
    strategy: StrategyResult;
    /** 잠긴 티어의 마스킹된 confidenceWeight(0) 오표시 방지. `SkillAccordionCard` 참조. */
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
    const readingContext = useReadingRenderContext();
    const title = skillLabel(strategy.strategyName);
    // 대순환 카드는 `summary`가 영어 정본이라 구조화된 `cycle`을 독자 언어로 푼다. `cycle`이
    // 없는 카드(옛 캐시·모델이 쓴 전략)와 표에 없는 종류는 기존 요약 렌더로 물러난다.
    const cycleLines =
        strategy.cycle === undefined
            ? null
            : renderCycleReading(strategy.cycle, readingContext);
    const sections = parseStructuredSummary(strategy.summary);
    const guidePath = guidePathForSkill(strategy.strategyName);

    return (
        <SkillAccordionCard
            id={strategy.id}
            title={title}
            trend={strategy.trend}
            confidenceWeight={strategy.confidenceWeight}
            showConfidence={showConfidence}
            overlay={overlay}
        >
            {cycleLines !== null ? (
                <CycleReadingSummary lines={cycleLines} />
            ) : sections !== null ? (
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
