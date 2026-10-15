import { useTranslations } from 'next-intl';
import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

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
