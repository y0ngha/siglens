import { useTranslations } from 'next-intl';
import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function FinancialsAiSummarySkeleton() {
    const t = useTranslations('widgets.financials');
    return (
        <AiSummarySkeleton
            heading={t('FinancialsAiSummarySkeleton.26f860')}
            idPrefix="financials-ai-summary"
            progressMessage={t('FinancialsAiSummarySkeleton.66140d')}
        />
    );
}
