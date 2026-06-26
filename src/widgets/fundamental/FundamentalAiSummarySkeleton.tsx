import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function FundamentalAiSummarySkeleton() {
    return (
        <AiSummarySkeleton
            heading="AI 펀더멘털 분석"
            idPrefix="ai-summary"
            progressMessage="AI 펀더멘털 분석 진행 중…"
        />
    );
}
