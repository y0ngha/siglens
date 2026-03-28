import type { AnalysisResponse } from '@/domain/types';
import { AnalysisPanel } from '@/components/analysis/AnalysisPanel';

interface AnalysisPanelWrapperProps {
    initialAnalysis: AnalysisResponse;
}

export function AnalysisPanelWrapper({
    initialAnalysis,
}: AnalysisPanelWrapperProps) {
    return <AnalysisPanel analysis={initialAnalysis} isAnalyzing={false} />;
}
