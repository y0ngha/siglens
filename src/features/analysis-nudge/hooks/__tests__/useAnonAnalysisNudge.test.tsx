import { renderHook, act } from '@testing-library/react';
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
    beforeEach(() => {
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

        const { result } = renderHook(() => useAnonAnalysisNudge());

        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(mockRecord).not.toHaveBeenCalled();
        expect(result.current.isOpen).toBe(false);
    });

    it('is a no-op for members (logged-in user)', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(MEMBER));

        const { result } = renderHook(() => useAnonAnalysisNudge());

        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(mockRecord).not.toHaveBeenCalled();
        expect(result.current.isOpen).toBe(false);
    });

    it('records the symbol for anonymous visitors (data=null, resolved)', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));

        const { result } = renderHook(() => useAnonAnalysisNudge());

        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(mockRecord).toHaveBeenCalledWith('AAPL');
    });

    it('opens the modal when the 3rd distinct symbol crosses the threshold and not shown today', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 3,
            crossedThreshold: true,
        });
        mockHasShown.mockReturnValue(false);

        const { result } = renderHook(() => useAnonAnalysisNudge());

        act(() => {
            result.current.onSymbolAnalyzed('NVDA');
        });

        expect(result.current.isOpen).toBe(true);
        expect(mockMarkShown).toHaveBeenCalledTimes(1);
    });

    it('does not open the modal if crossedThreshold but already shown today (nag-prevention)', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 3,
            crossedThreshold: true,
        });
        mockHasShown.mockReturnValue(true);

        const { result } = renderHook(() => useAnonAnalysisNudge());

        act(() => {
            result.current.onSymbolAnalyzed('NVDA');
        });

        expect(result.current.isOpen).toBe(false);
        expect(mockMarkShown).not.toHaveBeenCalled();
    });

    it('does not open the modal when crossedThreshold is false', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 1,
            crossedThreshold: false,
        });

        const { result } = renderHook(() => useAnonAnalysisNudge());

        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(result.current.isOpen).toBe(false);
    });

    it('close() sets isOpen back to false', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 3,
            crossedThreshold: true,
        });
        mockHasShown.mockReturnValue(false);

        const { result } = renderHook(() => useAnonAnalysisNudge());

        act(() => {
            result.current.onSymbolAnalyzed('NVDA');
        });
        expect(result.current.isOpen).toBe(true);

        act(() => {
            result.current.close();
        });
        expect(result.current.isOpen).toBe(false);
    });
});
