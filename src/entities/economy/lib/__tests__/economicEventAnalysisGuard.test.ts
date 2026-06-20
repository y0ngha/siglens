import { describe, it, expect } from 'vitest';
import { toEventSentiment } from '@/entities/economy/lib/economicEventAnalysisGuard';

describe('toEventSentiment', () => {
    it('passes through the three valid sentiments', () => {
        expect(toEventSentiment('bullish')).toBe('bullish');
        expect(toEventSentiment('neutral')).toBe('neutral');
        expect(toEventSentiment('bearish')).toBe('bearish');
    });

    it('coerces unknown strings to null', () => {
        expect(toEventSentiment('positive')).toBeNull();
        expect(toEventSentiment('')).toBeNull();
    });

    it('coerces null/undefined to null', () => {
        expect(toEventSentiment(null)).toBeNull();
        expect(toEventSentiment(undefined)).toBeNull();
    });
});
