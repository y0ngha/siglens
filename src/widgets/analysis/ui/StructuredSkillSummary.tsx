/**
 * `**라벨**: 값` 줄로 구조화된 전략 요약을 라벨/값 목록으로 그린다.
 */
import { LABEL_KO } from '@/shared/lib/typographyStyles';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import type { SkillSummarySection } from '../utils/parseStructuredSummary';

interface StructuredSkillSummaryProps {
    sections: SkillSummarySection[];
}

export function StructuredSkillSummary({
    sections,
}: StructuredSkillSummaryProps) {
    return (
        <div className="flex flex-col gap-2">
            {sections.map(section => (
                <div key={section.label} className="flex flex-col gap-0.5">
                    <span className={LABEL_KO}>{section.label}</span>
                    <MarkdownText className="text-xs text-secondary-300">
                        {section.value}
                    </MarkdownText>
                </div>
            ))}
        </div>
    );
}
