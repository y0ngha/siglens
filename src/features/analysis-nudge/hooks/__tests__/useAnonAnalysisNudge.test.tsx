import { renderHook, act } from '@testing-library/react';
import type { Mock } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { useAnonAnalysisNudge } from '@/features/analysis-nudge/hooks/useAnonAnalysisNudge';
import { useCurrentUser } from '@/entities/auth';
import {
    recordAnonSymbolAnalysis,
    hasNudgeShownToday,
    markNudgeShownToday,
} from '@/shared/lib/anonAnalysisCount';

vi.mock('@/entities/auth', () => ({
    useCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/anonAnalysisCount', () => ({
    recordAnonSymbolAnalysis: vi.fn(),
    hasNudgeShownToday: vi.fn(),
    markNudgeShownToday: vi.fn(),
}));

const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockRecord = vi.mocked(recordAnonSymbolAnalysis);
const mockHasShown = vi.mocked(hasNudgeShownToday);
const mockMarkShown = vi.mocked(markNudgeShownToday);

const MEMBER: AuthUserRecord = {
    id: 'u1',
    email: 'a@b.com',
    name: 'Alice',
    avatarUrl: null,
    tier: 'member',
} as AuthUserRecord;

function mockQueryResult(
    data: AuthUserRecord | null | undefined
): UseQueryResult<AuthUserRecord | null> {
    return { data } as UseQueryResult<AuthUserRecord | null>;
}

describe('useAnonAnalysisNudge', () => {
    // The shared opener injected by the caller (in production, the memoized
    // `openSignupNudge` from SymbolModelProvider). Crossing the threshold must
    // invoke THIS instead of any local state — the hook no longer owns the
    // modal's open-state, so both the header nudge and the auto-nudge open the
    // single provider-rendered instance.
    let openNudge: Mock<() => void>;

    beforeEach(() => {
        openNudge = vi.fn<() => void>();
        mockRecord.mockReset();
        mockHasShown.mockReset();
        mockMarkShown.mockReset();
        mockHasShown.mockReturnValue(false);
        mockRecord.mockReturnValue({
            distinctCount: 1,
            crossedThreshold: false,
        });
    });

    it('does not count before login state is resolved (data undefined)', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(undefined));

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        expect(result.current.isLoginResolved).toBe(false);
        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(mockRecord).not.toHaveBeenCalled();
        expect(openNudge).not.toHaveBeenCalled();
    });

    it('is a no-op for members (logged-in user)', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(MEMBER));

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(mockRecord).not.toHaveBeenCalled();
        expect(openNudge).not.toHaveBeenCalled();
    });

    it('records the symbol for anonymous visitors (data=null, resolved)', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        expect(result.current.isLoginResolved).toBe(true);
        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(mockRecord).toHaveBeenCalledWith('AAPL');
    });

    it('opens the shared modal when the 3rd distinct symbol crosses the threshold and not shown today', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 3,
            crossedThreshold: true,
        });
        mockHasShown.mockReturnValue(false);

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        act(() => {
            result.current.onSymbolAnalyzed('NVDA');
        });

        expect(openNudge).toHaveBeenCalledTimes(1);
        expect(mockMarkShown).toHaveBeenCalledTimes(1);
    });

    it('does not open the modal if crossedThreshold but already shown today (nag-prevention)', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 3,
            crossedThreshold: true,
        });
        mockHasShown.mockReturnValue(true);

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        act(() => {
            result.current.onSymbolAnalyzed('NVDA');
        });

        expect(openNudge).not.toHaveBeenCalled();
        expect(mockMarkShown).not.toHaveBeenCalled();
    });

    it('does not open the modal when crossedThreshold is false', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 1,
            crossedThreshold: false,
        });

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(openNudge).not.toHaveBeenCalled();
    });
});
