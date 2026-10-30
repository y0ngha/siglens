import { useTranslations } from 'next-intl';
import { MarkdownText } from '@/shared/ui/MarkdownText';
import { SectionCard } from '../ui/section/SectionCard';

interface OverallSummaryProps {
    headline: string;
}

/** 종합 분석 헤드라인 카드. 헤드라인이 비면 렌더하지 않는다. */
export function OverallSummary({ headline }: OverallSummaryProps) {
    const t = useTranslations('widgets.overall');
    if (!headline) return null;
    return (
        <SectionCard
            headingId="overall-summary-heading"
            title={t('OverallSummary.99a89d')}
        >
            <MarkdownText className="text-sm text-secondary-400">
                {headline}
            </MarkdownText>
        </SectionCard>
    );
}
