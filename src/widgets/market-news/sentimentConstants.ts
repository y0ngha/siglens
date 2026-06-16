import type { NewsSentiment } from '@y0ngha/siglens-core';

export const SENTIMENT_LABEL: Record<NewsSentiment, string> = {
    bullish: '긍정',
    neutral: '중립',
    bearish: '부정',
};

export const SENTIMENT_CLASS: Record<NewsSentiment, string> = {
    bullish: 'bg-ui-success/10 text-chart-bullish',
    neutral: 'bg-secondary-700 text-secondary-400',
    bearish: 'bg-ui-danger/10 text-chart-bearish',
};

export const VALID_SENTIMENTS: readonly NewsSentiment[] = [
    'bullish',
    'neutral',
    'bearish',
];

export function isNewsSentiment(value: unknown): value is NewsSentiment {
    return (
        typeof value === 'string' &&
        VALID_SENTIMENTS.includes(value as NewsSentiment)
    );
}
