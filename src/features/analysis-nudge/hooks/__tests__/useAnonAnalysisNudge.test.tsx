import { renderHook, act } from '@testing-library/react';
import type { Mock } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { useAnonAnalysisNudge } from '@/features/analysis-nudge/hooks/useAnonAnalysisNudge';
import { useCurrentUser } from '@/entities/auth/hooks/useCurrentUser';
import {
    recordAnonSymbolAnalysis,
    hasNudgeShownToday,
    markNudgeShownToday,
    nextAnonNudgeVariant,
    type SignupNudgeVariant,
} from '@/shared/lib/anonAnalysisCount';
import {
    hasNudgeShownThisSession,
    markNudgeShownThisSession,
} from '@/shared/lib/nudgeSession';
import { isVocPromptPending } from '@/shared/lib/vocPromptStorage';

vi.mock('@/entities/auth/hooks/useCurrentUser', () => ({
    useCurrentUser: vi.fn(),
}));

vi.mock('@/shared/lib/anonAnalysisCount', () => ({
    ANON_DISTINCT_SYMBOL_NUDGE_THRESHOLD: 1,
    recordAnonSymbolAnalysis: vi.fn(),
    hasNudgeShownToday: vi.fn(),
    markNudgeShownToday: vi.fn(),
    nextAnonNudgeVariant: vi.fn(),
}));

vi.mock('@/shared/lib/nudgeSession', () => ({
    hasNudgeShownThisSession: vi.fn(),
    markNudgeShownThisSession: vi.fn(),
}));

vi.mock('@/shared/lib/vocPromptStorage', () => ({
    isVocPromptPending: vi.fn(),
}));

const mockVocPending = vi.mocked(isVocPromptPending);
const mockUseCurrentUser = vi.mocked(useCurrentUser);
const mockRecord = vi.mocked(recordAnonSymbolAnalysis);
const mockHasShown = vi.mocked(hasNudgeShownToday);
const mockMarkShown = vi.mocked(markNudgeShownToday);
const mockNextVariant = vi.mocked(nextAnonNudgeVariant);
const mockSessionShown = vi.mocked(hasNudgeShownThisSession);
const mockMarkSession = vi.mocked(markNudgeShownThisSession);

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
    let openNudge: Mock<(variant: SignupNudgeVariant) => void>;

    beforeEach(() => {
        openNudge = vi.fn<(variant: SignupNudgeVariant) => void>();
        mockRecord.mockReset();
        mockHasShown.mockReset();
        mockMarkShown.mockReset();
        mockNextVariant.mockReset();
        mockSessionShown.mockReset();
        mockMarkSession.mockReset();
        mockVocPending.mockReset();
        mockVocPending.mockReturnValue(false);
        mockHasShown.mockReturnValue(false);
        mockSessionShown.mockReturnValue(false);
        mockNextVariant.mockReturnValue('emailReport');
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

    it('opens the shared modal with the next copy variant when the threshold is reached and not shown today', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 1,
            crossedThreshold: true,
        });
        mockHasShown.mockReturnValue(false);
        mockNextVariant.mockReturnValue('reasoning');

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        act(() => {
            result.current.onSymbolAnalyzed('NVDA');
        });

        expect(openNudge).toHaveBeenCalledTimes(1);
        expect(openNudge).toHaveBeenCalledWith('reasoning');
        expect(mockMarkShown).toHaveBeenCalledTimes(1);
        expect(mockMarkSession).toHaveBeenCalledTimes(1);
    });

    it('does not open the modal when another nudge was already shown this tab session', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 1,
            crossedThreshold: true,
        });
        mockSessionShown.mockReturnValue(true);

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        act(() => {
            result.current.onSymbolAnalyzed('NVDA');
        });

        expect(openNudge).not.toHaveBeenCalled();
        expect(mockMarkShown).not.toHaveBeenCalled();
        expect(mockNextVariant).not.toHaveBeenCalled();
    });

    it('does not open the modal if the threshold is reached but already shown today (nag-prevention)', () => {
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

    it('does not open the modal while the distinct count is below the threshold', () => {
        mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
        mockRecord.mockReturnValue({
            distinctCount: 0,
            crossedThreshold: false,
        });

        const { result } = renderHook(() => useAnonAnalysisNudge(openNudge));

        act(() => {
            result.current.onSymbolAnalyzed('AAPL');
        });

        expect(openNudge).not.toHaveBeenCalled();
    });

    describe('yielding to the VOC rating modal', () => {
        it('does not count, mark or open anything while the VOC prompt is still pending', () => {
            mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
            mockVocPending.mockReturnValue(true);
            mockRecord.mockReturnValue({
                distinctCount: 1,
                crossedThreshold: true,
            });

            const { result } = renderHook(() =>
                useAnonAnalysisNudge(openNudge)
            );
            act(() => {
                result.current.onSymbolAnalyzed('NVDA');
            });

            expect(mockRecord).not.toHaveBeenCalled();
            expect(openNudge).not.toHaveBeenCalled();
            expect(mockMarkShown).not.toHaveBeenCalled();
            expect(mockMarkSession).not.toHaveBeenCalled();
        });

        it('fires the deferred nudge on a later analysis once the VOC prompt is no longer pending', () => {
            mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
            // The deferred nudge's own threshold crossing already happened on the
            // yielded call, so this later call reports crossedThreshold: false.
            mockRecord.mockReturnValue({
                distinctCount: 2,
                crossedThreshold: false,
            });
            mockVocPending.mockReturnValue(true);

            const { result } = renderHook(() =>
                useAnonAnalysisNudge(openNudge)
            );
            act(() => {
                result.current.onSymbolAnalyzed('NVDA');
            });
            expect(openNudge).not.toHaveBeenCalled();

            mockVocPending.mockReturnValue(false);
            act(() => {
                result.current.onSymbolAnalyzed('AAPL');
            });

            expect(openNudge).toHaveBeenCalledTimes(1);
            expect(mockMarkShown).toHaveBeenCalledTimes(1);
            expect(mockMarkSession).toHaveBeenCalledTimes(1);
        });

        it('still honors the once-per-day cap after the VOC prompt is done', () => {
            mockUseCurrentUser.mockReturnValue(mockQueryResult(null));
            mockRecord.mockReturnValue({
                distinctCount: 2,
                crossedThreshold: false,
            });
            mockHasShown.mockReturnValue(true);

            const { result } = renderHook(() =>
                useAnonAnalysisNudge(openNudge)
            );
            act(() => {
                result.current.onSymbolAnalyzed('AAPL');
            });

            expect(openNudge).not.toHaveBeenCalled();
        });
    });
});
