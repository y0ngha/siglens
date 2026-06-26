import { AiSummarySkeleton } from '@/shared/ui/AiSummarySkeleton';

export function CongressTrendSummarySkeleton() {
    return (
        <AiSummarySkeleton
            heading="AI 동향 해석"
            idPrefix="congress-trend-summary"
            progressMessage="AI 동향 해석 진행 중…"
        />
    );
}
