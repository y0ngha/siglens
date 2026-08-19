import { useTranslations } from 'next-intl';
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
    bullish: 'bg-ui-success/10 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-300',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
};

interface CongressTrendSummaryViewProps {
    result: CongressTrendResponse;
}

export function CongressTrendSummaryView({
    result,
}: CongressTrendSummaryViewProps) {
    const t = useTranslations('widgets.congress');
    const sentimentLabel = SENTIMENT_LABEL[result.overallSentiment];

    return (
        <section
            aria-labelledby="congress-trend-summary-heading"
            className="rounded-xl border border-secondary-700 bg-secondary-800 p-6"
        >
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2
                    id="congress-trend-summary-heading"
                    className="text-lg font-semibold tracking-tight"
                >
                    {t('CongressTrendSummaryView.bbb041')}
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

            <p className="mb-5 text-sm leading-relaxed text-secondary-400">
                {result.summaryKo}
            </p>

            {result.notableMembersKo.length > 0 && (
                <div className="mb-5">
                    <h3 className="mb-2 text-sm font-semibold">
                        {t('CongressTrendSummaryView.9a15c9')}
                    </h3>
                    <ul
                        aria-label={t('CongressTrendSummaryView.9a15c9')}
                        className="space-y-1.5"
                    >
                        {result.notableMembersKo.map((member, i) => (
                            <li
                                key={`member-${i}-${member}`}
                                className="flex gap-2 text-sm text-secondary-400"
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
                    <h3 className="mb-2 text-sm font-semibold">
                        {t('CongressTrendSummaryView.b2e4d7')}
                    </h3>
                    <p className="text-sm leading-relaxed text-secondary-400">
                        {result.riskNoteKo}
                    </p>
                </div>
            )}
        </section>
    );
}
