import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { SectionCard } from '../ui/section/SectionCard';

interface IntegratedConclusionProps {
    text: string;
}

/**
 * 축별 요약을 묶어 한 페이지의 최종 결론을 제시하는 focal 섹션. 형제 축 요약과
 * 구분되도록 primary 톤 카드를 쓴다. 본문이 비면 렌더하지 않는다.
 */
export function IntegratedConclusion({ text }: IntegratedConclusionProps) {
    const t = useTranslations('widgets.overall');
    if (!text) return null;
    return (
        <SectionCard
            headingId="overall-integrated-conclusion-heading"
            title={t('IntegratedConclusion.85f201')}
            tone="focal"
        >
            <MarkdownText className="text-sm">{text}</MarkdownText>
        </SectionCard>
    );
}
