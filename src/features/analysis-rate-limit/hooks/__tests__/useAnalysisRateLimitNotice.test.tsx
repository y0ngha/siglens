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

const { unsubscribeSpy } = vi.hoisted(() => ({ unsubscribeSpy: vi.fn() }));

// 실제 채널은 그대로 쓰고, 해제 함수가 불렸는지만 기록한다 — 언마운트 뒤에는
// `result.current`가 갱신되지 않아 상태로는 해제 여부를 볼 수 없다.
vi.mock('@/shared/lib/sse/analysisRateLimitSignal', async importOriginal => {
    const actual =
        await importOriginal<
            typeof import('@/shared/lib/sse/analysisRateLimitSignal')
        >();
    return {
        ...actual,
        subscribeAnalysisRateLimited: (
            listener: Parameters<typeof actual.subscribeAnalysisRateLimited>[0]
        ) => {
            const unsubscribe = actual.subscribeAnalysisRateLimited(listener);
            return () => {
                unsubscribeSpy();
                unsubscribe();
            };
        },
    };
});

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
        unsubscribeSpy.mockClear();
        const { unmount } = renderHook(() => useAnalysisRateLimitNotice());
        expect(unsubscribeSpy).not.toHaveBeenCalled();
        unmount();
        expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
    });

    it('keeps dismiss stable across renders', () => {
        const { result } = renderHook(() => useAnalysisRateLimitNotice());
        const { dismiss } = result.current;
        publish(GUEST_QUOTA);
        expect(result.current.dismiss).toBe(dismiss);
    });
});
