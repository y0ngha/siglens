import {
    isNewsSentiment,
    SENTIMENT_LABEL,
    SENTIMENT_CLASS,
} from '@/shared/lib/sentimentDisplay';

describe('isNewsSentiment', () => {
    it('returns true for bullish', () => {
        expect(isNewsSentiment('bullish')).toBe(true);
    });

    it('returns true for neutral', () => {
        expect(isNewsSentiment('neutral')).toBe(true);
    });

    it('returns true for bearish', () => {
        expect(isNewsSentiment('bearish')).toBe(true);
    });

    it('returns false for an unknown string', () => {
        expect(isNewsSentiment('sideways')).toBe(false);
    });

    it('returns false for an empty string', () => {
        expect(isNewsSentiment('')).toBe(false);
    });

    it('returns false for null', () => {
        expect(isNewsSentiment(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isNewsSentiment(undefined)).toBe(false);
    });

    it('returns false for a number', () => {
        expect(isNewsSentiment(42)).toBe(false);
    });

    it('returns false for an object', () => {
        expect(isNewsSentiment({ sentiment: 'bullish' })).toBe(false);
    });
});

describe('SENTIMENT_LABEL', () => {
    it('bullish maps to 긍정', () => {
        expect(SENTIMENT_LABEL.bullish).toBe('긍정');
    });

    it('neutral maps to 중립', () => {
        expect(SENTIMENT_LABEL.neutral).toBe('중립');
    });

    it('bearish maps to 부정', () => {
        expect(SENTIMENT_LABEL.bearish).toBe('부정');
    });
});

describe('SENTIMENT_CLASS', () => {
    it('bullish maps to success class', () => {
        expect(SENTIMENT_CLASS.bullish).toBe(
            'bg-ui-success/10 text-ui-success-text'
        );
    });

    it('neutral maps to secondary class', () => {
        expect(SENTIMENT_CLASS.neutral).toBe(
            'bg-secondary-700 text-secondary-300'
        );
    });

    it('bearish maps to danger class', () => {
        expect(SENTIMENT_CLASS.bearish).toBe(
            'bg-ui-danger/10 text-ui-danger-text'
        );
    });
});
