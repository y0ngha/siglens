/**
 * AI 해석 로딩 스켈레톤.
 */
import { useTranslations } from 'next-intl';
import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

/** AI 해석 로딩 중 자리를 잡는 스켈레톤. */
export function InvestorFlowsSummarySkeleton() {
    const t = useTranslations('widgets.investor-flows');
    return (
        <AiSummarySkeleton
            heading={t('ai.title')}
            idPrefix="investor-flows-summary"
            progressMessage={t('ai.progress')}
        />
    );
}
