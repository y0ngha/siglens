import { useTranslations } from 'next-intl';
import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function CongressTrendSummarySkeleton() {
    const t = useTranslations('widgets.congress');
    return (
        <AiSummarySkeleton
            heading={t('CongressTrendSummarySkeleton.bbb041')}
            idPrefix="congress-trend-summary"
            progressMessage={t('CongressTrendSummarySkeleton.de5a93')}
        />
    );
}
