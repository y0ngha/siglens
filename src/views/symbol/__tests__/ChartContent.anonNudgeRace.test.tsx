import { render, waitFor } from '@testing-library/react';
import type { AnalysisResponse, Timeframe } from '@y0ngha/siglens-core';
import type { UseQueryResult } from '@tanstack/react-query';
import type { AuthUserRecord } from '@/shared/lib/auth/types';
import { ChartContent } from '@/views/symbol/ChartContent';
import { useCurrentUser } from '@/entities/auth';
import {
    recordAnonSymbolAnalysis,
    hasNudgeShownToday,
    markNudgeShownToday,
} from '@/shared/lib/anonAnalysisCount';

// Regression test for the anonymous-nudge missed-fire on cache-HIT + cold
// currentUser (member-reasoning-toggle spec Part B code review finding #1).
//
// Unlike ChartContent.test.tsx, this file does NOT mock `@/features/analysis-nudge`
// — it exercises the REAL `useAnonAnalysisNudge` hook wired into the REAL
// ChartContent effect (notifiedSymbolRef). Mocking the feature (as the sibling
// test file does) gives `onSymbolAnalyzed` a stable identity across renders,
// which hides the race entirely: the bug only manifests when `onSymbolAnalyzed`
// changes identity (member no-op → real anonymous fn) AFTER the ref has
// already been set.

vi.mock('next/dynamic', () => ({
    default: (_loader: () => Promise<{ default: React.FC }>) => {
        const Component = (_props: Record<string, unknown>) => (
            <div data-testid="dynamic-component" />
        );
        Component.displayName = 'DynamicMock';
        return Component;
    },
}));

vi.mock('@/shared/lib/cn', () => ({
    cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}));

vi.mock('@/widgets/chart', () => ({
    ChartSkeleton: () => <div data-testid="chart-skeleton" />,
    useChartSync: () => ({
        handleStockChartReady: vi.fn(),
        handleStockChartRemove: vi.fn(),
        handleVolumeChartReady: vi.fn(),
        handleVolumeChartRemove: vi.fn(),
    }),
}));

vi.mock('@/widgets/analysis', () => ({
    AnalysisPanel: () => <div data-testid="analysis-panel" />,
}));

vi.mock('@/shared/ui/BotBlockedNotice', () => ({
    BotBlockedNotice: () => <div data-testid="bot-blocked-notice" />,
}));

vi.mock('@/entities/bars/hooks/useBars', () => ({
    useBars: vi.fn(() => ({
        bars: [
            { time: 1, open: 100, high: 110, low: 90, close: 105, volume: 500 },
        ],
        indicators: { buySellVolume: [] },
    })),
}));

// `analysis: {}` — a non-fallback narrative present from the very first
// render, standing in for a cache-HIT `initialAnalysis` that is already a
// real narrative on mount (the exact scenario in the finding).
vi.mock('@/views/symbol/hooks/useAnalysis', () => ({
    useAnalysis: vi.fn(() => ({
        analysis: {} as AnalysisResponse,
        analysisResult: null,
        isAnalyzing: false,
        analysisError: null,
        isBotBlocked: false,
        handleReanalyze: vi.fn(),
        reanalyzeCooldownMs: 0,
        cooldownNotice: null,
        isPersonalized: false,
    })),
}));

vi.mock('@/views/symbol/hooks/useAnalysisDerivedData', () => ({
    useAnalysisDerivedData: vi.fn(() => ({
        clusteredKeyLevels: { support: [], resistance: [], poc: undefined },
        validatedActionPrices: undefined,
        reconciledActionLines: undefined,
    })),
}));

vi.mock('@/views/symbol/hooks/useAnalysisDisplay', () => ({
    useAnalysisDisplay: vi.fn(() => ({
        displayAnalyzing: false,
        handleProgressFinished: vi.fn(),
    })),
}));

vi.mock('@/views/symbol/hooks/useActionPricesVisibility', () => ({
    useActionPricesVisibility: vi.fn(() => ({
        actionPricesVisible: true,
        setActionPricesVisible: vi.fn(),
    })),
}));

// Stable shared opener — in production this is the provider's memoized
// `openSignupNudge`. It must keep a stable identity across renders so the real
// hook's `onSymbolAnalyzed` only changes identity when login resolution flips
// (the exact seam this race test exercises via notifiedSymbolRef).
const { mockOpenSignupNudge } = vi.hoisted(() => ({
    mockOpenSignupNudge: vi.fn(),
}));

vi.mock('@/features/symbol-model/model/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({
        modelId: 'gemini-2.5-flash-lite',
        isHydrated: true,
        reasoning: false,
        isReasoningHydrated: true,
        openSignupNudge: mockOpenSignupNudge,
    })),
}));

vi.mock('@/views/symbol/SymbolPageContext', () => ({
    useSymbolPageContext: vi.fn(() => ({ indicatorCount: 25 })),
}));

vi.mock('@/views/symbol/hooks/usePanelResize', () => ({
    usePanelResize: vi.fn(() => ({
        panelWidth: 640,
        isDragging: false,
        handleDragStart: vi.fn(),
        handleKeyDown: vi.fn(),
    })),
    PANEL_MIN_WIDTH: 240,
    PANEL_MAX_WIDTH: 640,
}));

vi.mock('@/widgets/analysis/hooks/useAnalysisProgress', () => ({
    useAnalysisProgress: vi.fn(() => ({
        phaseIndex: 0,
        tipIndex: 0,
    })),
}));

vi.mock('@/features/symbol-chat', () => ({
    usePublishSymbolChat: vi.fn(),
}));

vi.mock('@/views/symbol/utils/buildChatState', () => ({
    buildChatState: vi.fn(() => ({
        context: null,
        timeframe: '1Day',
        isAnalysisReady: false,
    })),
}));

vi.mock('@/shared/lib/pwaEvents', () => ({
    PWA_TRIGGER_EVENT: 'pwa-trigger',
}));

// The two seams the real bug lives in: login-state resolution
// (`useCurrentUser`) and the localStorage-backed distinct-symbol counter
// (`anonAnalysisCount`). `@/features/analysis-nudge` itself is left unmocked.
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

function queryResult(
    data: AuthUserRecord | null | undefined
): UseQueryResult<AuthUserRecord | null> {
    return { data } as UseQueryResult<AuthUserRecord | null>;
}

describe('ChartContent × useAnonAnalysisNudge integration (real hook, race between login-resolve and cache-HIT render)', () => {
    const baseProps = {
        companyName: 'Test Co.',
        timeframe: '1Day' as Timeframe,
        timeframeChangeCount: 0,
        initialAnalysis: {} as AnalysisResponse,
        initialAnalysisFailed: false,
        onMobileSheetContent: vi.fn(),
    };

    beforeEach(() => {
        mockRecord.mockReset();
        mockHasShown.mockReset();
        mockMarkShown.mockReset();
        mockOpenSignupNudge.mockReset();
        mockHasShown.mockReturnValue(false);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('records the cache-HIT symbol exactly once after a cold session resolves from unresolved to anonymous, instead of being silently dropped by the notifiedSymbolRef race', async () => {
        // Cold session: useCurrentUser has not settled yet (data === undefined).
        mockUseCurrentUser.mockReturnValue(queryResult(undefined));
        mockRecord.mockReturnValueOnce({
            distinctCount: 1,
            crossedThreshold: false,
        });

        const { rerender } = render(
            <ChartContent {...baseProps} symbol="RACE" />
        );

        // Login unresolved — must not have recorded anything yet (neither the
        // no-op branch nor the real one).
        expect(mockRecord).not.toHaveBeenCalled();

        // Login settles: anonymous visitor. This is the state transition that
        // flips `onSymbolAnalyzed`'s identity from the no-op variant to the
        // real one inside useAnonAnalysisNudge.
        mockUseCurrentUser.mockReturnValue(queryResult(null));
        rerender(<ChartContent {...baseProps} symbol="RACE" />);

        // With the fix, ChartContent's effect re-runs once isNudgeLoginResolved
        // flips true and records the already-rendered (cache-HIT) symbol.
        // Against the pre-fix code, `notifiedSymbolRef.current` was already set
        // to 'RACE' during the unresolved render, so this call never happens —
        // making this assertion fail on the old code.
        await waitFor(() => {
            expect(mockRecord).toHaveBeenCalledWith('RACE');
        });
        expect(mockRecord).toHaveBeenCalledTimes(1);
    });

    it('opens the signup nudge at the 3rd distinct symbol (not the 4th) when the first symbol only resolved after a cold-session race', async () => {
        // Three distinct real `recordAnonSymbolAnalysis` calls are expected in
        // symbol order: RACE1 (after the cold-session race resolves), then
        // SYM2, then SYM3. Queueing them FIFO means that if RACE1's call is
        // silently dropped (the pre-fix bug), SYM2 consumes RACE1's queued
        // result and SYM3 consumes SYM2's (crossedThreshold: false) — so the
        // nudge never opens by SYM3 against the old code, exactly mirroring
        // the "3rd shifts to 4th" regression described in the finding.
        mockRecord.mockReturnValueOnce({
            distinctCount: 1,
            crossedThreshold: false,
        });
        mockRecord.mockReturnValueOnce({
            distinctCount: 2,
            crossedThreshold: false,
        });
        mockRecord.mockReturnValueOnce({
            distinctCount: 3,
            crossedThreshold: true,
        });

        // Symbol 1: cache-HIT + cold-session race (undefined -> null).
        mockUseCurrentUser.mockReturnValue(queryResult(undefined));
        const race = render(<ChartContent {...baseProps} symbol="RACE1" />);
        expect(mockRecord).not.toHaveBeenCalled();

        mockUseCurrentUser.mockReturnValue(queryResult(null));
        race.rerender(<ChartContent {...baseProps} symbol="RACE1" />);
        await waitFor(() => {
            expect(mockRecord).toHaveBeenCalledWith('RACE1');
        });
        race.unmount();

        // Symbol 2: a fresh page visit — login is already resolved by mount.
        const sym2 = render(<ChartContent {...baseProps} symbol="SYM2" />);
        await waitFor(() => {
            expect(mockRecord).toHaveBeenCalledWith('SYM2');
        });
        sym2.unmount();

        // Symbol 3: crosses the threshold — this is the 3rd DISTINCT symbol
        // only if RACE1 was actually counted.
        render(<ChartContent {...baseProps} symbol="SYM3" />);
        await waitFor(() => {
            expect(mockRecord).toHaveBeenCalledWith('SYM3');
        });
        expect(mockRecord).toHaveBeenCalledTimes(3);

        // The nudge now opens via the provider's shared opener (the single
        // modal instance is rendered by SymbolModelProvider, not ChartContent),
        // so we assert the opener fired exactly once at the 3rd distinct symbol.
        await waitFor(() => {
            expect(mockOpenSignupNudge).toHaveBeenCalledTimes(1);
        });
        expect(mockMarkShown).toHaveBeenCalledTimes(1);
    });
});
