import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function FinancialsAiSummarySkeleton() {
    return (
        <AiSummarySkeleton
            heading="AI 재무제표 분석"
            idPrefix="financials-ai-summary"
            progressMessage="AI 재무제표 분석 진행 중…"
        />
    );
}
