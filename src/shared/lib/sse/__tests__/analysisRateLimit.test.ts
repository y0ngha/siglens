import { describe, expect, it } from 'vitest';
import { isAnalysisRateLimitPayload } from '@/shared/lib/sse/analysisRateLimit';

const VALID = {
    audience: 'guest',
    reason: 'quota',
    retryAt: 1_790_000_000_000,
};

describe('isAnalysisRateLimitPayload', () => {
    it.each([
        ['guest quota', VALID],
        [
            'member unavailable',
            { ...VALID, audience: 'member', reason: 'unavailable' },
        ],
    ])('accepts a valid payload (%s)', (_label, payload) => {
        expect(isAnalysisRateLimitPayload(payload)).toBe(true);
    });

    it.each([null, undefined, 'rate_limited', 42, []])(
        'rejects a non-object (%j)',
        value => {
            expect(isAnalysisRateLimitPayload(value)).toBe(false);
        }
    );

    it.each(['audience', 'reason', 'retryAt'] as const)(
        'rejects a payload missing %s',
        field => {
            const { [field]: _omitted, ...rest } = VALID;
            expect(isAnalysisRateLimitPayload(rest)).toBe(false);
        }
    );

    it.each([
        ['an unknown audience', { ...VALID, audience: 'admin' }],
        ['an unknown reason', { ...VALID, reason: 'banned' }],
        ['NaN retryAt', { ...VALID, retryAt: Number.NaN }],
        ['Infinity retryAt', { ...VALID, retryAt: Number.POSITIVE_INFINITY }],
        ['a string retryAt', { ...VALID, retryAt: '1790000000000' }],
    ])('rejects %s', (_label, payload) => {
        expect(isAnalysisRateLimitPayload(payload)).toBe(false);
    });
});
