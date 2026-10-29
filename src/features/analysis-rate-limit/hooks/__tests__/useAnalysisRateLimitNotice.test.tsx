import { act, renderHook } from '@testing-library/react';
import { useAnalysisRateLimitNotice } from '@/features/analysis-rate-limit/hooks/useAnalysisRateLimitNotice';
import type { AnalysisRateLimitPayload } from '@/shared/lib/sse/analysisRateLimit';
import { publishAnalysisRateLimited } from '@/shared/lib/sse/analysisRateLimitSignal';

const RETRY_AT = Date.parse('2026-10-07T00:00:00.000Z');
const GUEST_QUOTA: AnalysisRateLimitPayload = {
    audience: 'guest',
    reason: 'quota',
    retryAt: RETRY_AT,
};

function publish(payload: AnalysisRateLimitPayload): void {
    act(() => publishAnalysisRateLimited(payload));
}

describe('useAnalysisRateLimitNotice', () => {
    it('starts closed and opens on a guest quota rejection', () => {
        const { result } = renderHook(() => useAnalysisRateLimitNotice());
        expect(result.current.notice).toBeNull();

        publish(GUEST_QUOTA);
        expect(result.current.notice).toEqual(GUEST_QUOTA);
    });

    it('stays dismissed for the same window and reopens for a later one', () => {
        const { result } = renderHook(() => useAnalysisRateLimitNotice());
        publish(GUEST_QUOTA);
        act(() => result.current.dismiss());
        expect(result.current.notice).toBeNull();

        publish(GUEST_QUOTA);
        expect(result.current.notice).toBeNull();

        const later = { ...GUEST_QUOTA, retryAt: RETRY_AT + 1 };
        publish(later);
        expect(result.current.notice).toEqual(later);
    });

    it('unsubscribes on unmount', () => {
        const { result, unmount } = renderHook(() =>
            useAnalysisRateLimitNotice()
        );
        unmount();
        publish(GUEST_QUOTA);
        expect(result.current.notice).toBeNull();
    });
});
