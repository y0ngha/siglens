import { useTranslations } from 'next-intl';
import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function FundamentalAiSummarySkeleton() {
    const t = useTranslations('widgets.fundamental');
    return (
        <AiSummarySkeleton
            heading={t('FundamentalAiSummarySkeleton.17769c')}
            idPrefix="ai-summary"
            progressMessage={t('FundamentalAiSummarySkeleton.a68a30')}
        />
    );
}
