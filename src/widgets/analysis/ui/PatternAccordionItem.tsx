'use client';

/**
 * 감지된 차트 패턴 카드 — 펼치면 요약, 핵심 가격, 가이드 링크를 보여준다.
 */
import { useTranslations } from 'next-intl';
import type { KrxTickTable, PatternResult } from '@y0ngha/siglens-core';
import { useSkillLabel } from '@/shared/i18n/skillLabel';
import { useResolvedLocale } from '@/shared/i18n/useResolvedLocale';
import { formatAnalysisPrice } from '@/shared/lib/analysisPriceFormat';
import { guidePathForSkill } from '@/shared/lib/guideLinkLookup';
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { GuideHintLink } from '../GuideHintLink';
import type { OverlayCardControls } from '../model/types';
import { SkillAccordionCard } from './SkillAccordionCard';

interface PatternAccordionItemProps {
    pattern: PatternResult;
    /** 잠긴 티어의 마스킹된 confidenceWeight(0) 오표시 방지. `SkillAccordionCard` 참조. */
    showConfidence: boolean;
    /** 차트 작도 제어 — 이 항목에 그려지는 작도가 없으면 undefined(버튼 없음). */
    overlay?: OverlayCardControls;
    symbol: string;
    krxTickTable: KrxTickTable;
}

export function PatternAccordionItem({
    pattern,
    showConfidence,
    overlay,
    symbol,
    krxTickTable,
}: PatternAccordionItemProps) {
    const t = useTranslations('widgets.analysis');
    const skillLabel = useSkillLabel();
    const locale = useResolvedLocale();

    const title = skillLabel(pattern.skillName);
    const primaryLabel =
        pattern.renderConfig?.label ?? t('AnalysisPanel.fb0cf0');
    const keyPrices = pattern.keyPrices ?? [];
    const guidePath = guidePathForSkill(pattern.skillName, pattern.patternName);

    return (
        <SkillAccordionCard
            id={pattern.id}
            title={title}
            trend={pattern.trend}
            confidenceWeight={pattern.confidenceWeight}
            showConfidence={showConfidence}
            overlay={overlay}
        >
            <MarkdownText className="text-xs text-secondary-400">
                {pattern.summary}
            </MarkdownText>
            {keyPrices.length > 0 && (
                <div className="flex flex-col gap-1">
                    <span className={LABEL_KO}>
                        {t('AnalysisPanel.251228')}
                    </span>
                    <div className="flex flex-col gap-1">
                        {keyPrices.map((kp, index) => (
                            <div
                                key={`keyprice-${kp.label}`}
                                className="flex items-baseline gap-2"
                            >
                                <span className="w-16 shrink-0 text-xs text-secondary-500">
                                    {index === 0 ? primaryLabel : kp.label}
                                </span>
                                <span className="text-xs font-medium text-secondary-200 tabular-nums">
                                    {formatAnalysisPrice(
                                        kp.price,
                                        symbol,
                                        locale,
                                        { krxTickTable }
                                    )}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            {guidePath !== null && (
                <GuideHintLink href={guidePath} name={title} />
            )}
        </SkillAccordionCard>
    );
}
