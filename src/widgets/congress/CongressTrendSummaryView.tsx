import type {
    CongressSentiment,
    CongressTrendResponse,
} from '@y0ngha/siglens-core';
import { cn } from '@/shared/lib/cn';

const SENTIMENT_LABEL: Record<CongressSentiment, string> = {
    bullish: '매수 우위',
    neutral: '중립',
    bearish: '매도 우위',
};

// FinancialsAiSummaryView와 동일한 background/foreground 페어를 사용한다.
const SENTIMENT_CLASS: Record<CongressSentiment, string> = {
    bullish: 'bg-ui-success/10 text-success-text',
    neutral: 'bg-secondary-700 text-secondary-300',
    bearish: 'bg-ui-danger/10 text-danger-text',
};

interface CongressTrendSummaryViewProps {
    result: CongressTrendResponse;
}

export function CongressTrendSummaryView({
    result,
}: CongressTrendSummaryViewProps) {
    const sentimentLabel = SENTIMENT_LABEL[result.overallSentiment];

    return (
        <section
            aria-labelledby="congress-trend-summary-heading"
            className="border-secondary-700 bg-secondary-800 rounded-xl border p-6"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="congress-trend-summary-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    AI 동향 해석
                </h2>
                <span
                    role="img"
                    aria-label={`전반적 동향: ${sentimentLabel}`}
                    className={cn(
                        'rounded px-2 py-0.5 text-xs font-medium',
                        SENTIMENT_CLASS[result.overallSentiment]
                    )}
                >
                    {sentimentLabel}
                </span>
            </div>

            <p className="text-secondary-400 mb-5 text-sm leading-relaxed">
                {result.summaryKo}
            </p>

            {result.notableMembersKo.length > 0 && (
                <div className="mb-5">
                    <h3 className="mb-2 text-sm font-semibold">주목할 인물</h3>
                    <ul aria-label="주목할 인물" className="space-y-1.5">
                        {result.notableMembersKo.map((member, i) => (
                            <li
                                key={`member-${i}-${member}`}
                                className="text-secondary-400 flex gap-2 text-sm"
                            >
                                <span
                                    aria-hidden="true"
                                    className="mt-0.5 shrink-0"
                                >
                                    •
                                </span>
                                {member}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {result.riskNoteKo.trim().length > 0 && (
                <div>
                    <h3 className="mb-2 text-sm font-semibold">참고 사항</h3>
                    <p className="text-secondary-400 text-sm leading-relaxed">
                        {result.riskNoteKo}
                    </p>
                </div>
            )}
        </section>
    );
}
