import type { NewsSentiment } from '@y0ngha/siglens-core';

export const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

export const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-ui-success-text',
    neutral: 'bg-secondary-700 text-secondary-300',
    bearish: 'bg-ui-danger/10 text-ui-danger-text',
};

/**
 * Type guard for {@link NewsSentiment}. Uses {@link SENTIMENT_LABEL}
 * (Record<NewsSentiment, string>) as the exhaustiveness source — if core adds a
 * new sentiment, the SENTIMENT_LABEL definition fails to compile, preventing
 * silent drift.
 */
export function isNewsSentiment(value: unknown): value is NewsSentiment {
    return typeof value === 'string' && value in SENTIMENT_LABEL;
}
