import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function NewsAiSummarySkeleton() {
    return (
        <AiSummarySkeleton
            heading="AI 뉴스 종합 분석"
            idPrefix="news-ai-summary"
            progressMessage="AI 뉴스 분석 진행 중…"
            className="w-full max-w-full min-w-0 overflow-hidden"
        />
    );
}
