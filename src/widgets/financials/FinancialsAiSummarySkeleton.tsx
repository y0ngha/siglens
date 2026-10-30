/**
 * 재무 AI 요약 로딩 스켈레톤.
 */
import { useTranslations } from 'next-intl';
import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

/** 분석이 도는 동안 제목과 진행 문구를 보여 준다. */
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
