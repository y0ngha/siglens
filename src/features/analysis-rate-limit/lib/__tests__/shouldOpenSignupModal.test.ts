import { shouldOpenSignupModal } from '@/features/analysis-rate-limit/lib/shouldOpenSignupModal';

const RETRY_AT = Date.parse('2026-10-07T00:00:00.000Z');

describe('shouldOpenSignupModal', () => {
    it('opens for a guest quota rejection newer than the last shown one', () => {
        expect(
            shouldOpenSignupModal(
                { audience: 'guest', reason: 'quota', retryAt: RETRY_AT },
                0
            )
        ).toBe(true);
    });

    it('does not open for members', () => {
        expect(
            shouldOpenSignupModal(
                { audience: 'member', reason: 'quota', retryAt: RETRY_AT },
                0
            )
        ).toBe(false);
    });

    it('does not open for a quota-store outage', () => {
        expect(
            shouldOpenSignupModal(
                { audience: 'guest', reason: 'unavailable', retryAt: RETRY_AT },
                0
            )
        ).toBe(false);
    });

    it('does not reopen for the same or an earlier window', () => {
        const payload = {
            audience: 'guest',
            reason: 'quota',
            retryAt: RETRY_AT,
        } as const;
        expect(shouldOpenSignupModal(payload, RETRY_AT)).toBe(false);
        expect(shouldOpenSignupModal(payload, RETRY_AT + 1)).toBe(false);
    });

    it('reopens for a later window (hour limit -> day limit)', () => {
        expect(
            shouldOpenSignupModal(
                { audience: 'guest', reason: 'quota', retryAt: RETRY_AT + 1 },
                RETRY_AT
            )
        ).toBe(true);
    });
});
