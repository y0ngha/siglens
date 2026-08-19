import { useTranslations } from 'next-intl';
import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function NewsAiSummarySkeleton() {
    const t = useTranslations('widgets.news');
    return (
        <AiSummarySkeleton
            heading={t('NewsAiSummarySkeleton.ed8166')}
            idPrefix="news-ai-summary"
            progressMessage={t('NewsAiSummarySkeleton.b86179')}
            className="w-full max-w-full min-w-0 overflow-hidden"
        />
    );
}
