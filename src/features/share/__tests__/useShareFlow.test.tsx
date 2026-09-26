// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { useShareFlow } from '@/features/share/hooks/useShareFlow';
import type { ShareableRegistration } from '@/features/share/model/ShareableAnalysisContext';
import { createShareSnapshotAction } from '@/entities/shared-analysis/actions/createShareSnapshotAction';
import en from '@/../messages/en.json';

const { mockUseShareable, mockUseUserTier } = vi.hoisted(() => ({
    mockUseShareable: vi.fn(),
    mockUseUserTier: vi.fn(),
}));

vi.mock('@/features/share/model/ShareableAnalysisContext', async () => {
    const actual = await vi.importActual<
        typeof import('@/features/share/model/ShareableAnalysisContext')
    >('@/features/share/model/ShareableAnalysisContext');
    return {
        ...actual,
        useShareable: mockUseShareable,
    };
});

vi.mock('@/features/symbol-model/hooks/useUserTier', () => ({
    useUserTier: mockUseUserTier,
}));

vi.mock('@/entities/shared-analysis/actions/createShareSnapshotAction', () => ({
    createShareSnapshotAction: vi.fn(),
}));

const mockCreateShareSnapshot = vi.mocked(createShareSnapshotAction);

function baseReg(
    overrides: Partial<ShareableRegistration> = {}
): ShareableRegistration {
    return {
        kind: 'chart',
        status: 'success',
        result: { trend: 'bullish' },
        context: {
            symbol: 'AAPL',
            displayName: 'Apple',
            assetClass: 'us_equity',
        },
        trigger: vi.fn(),
        ...overrides,
    } as unknown as ShareableRegistration;
}

function wrapper({ children }: { children: React.ReactNode }) {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    return (
        <QueryClientProvider client={client}>
            <NextIntlClientProvider locale="en" messages={en}>
                {children}
            </NextIntlClientProvider>
        </QueryClientProvider>
    );
}

describe('useShareFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserTier.mockReturnValue({ tier: 'free', isLoading: false });
        Object.defineProperty(navigator, 'share', {
            value: undefined,
            configurable: true,
            writable: true,
        });
    });

    it('shows the inline unavailable notice when nothing is registered', () => {
        mockUseShareable.mockReturnValue(null);
        const { result } = renderHook(() => useShareFlow(), { wrapper });

        act(() => result.current.onClick());

        expect(result.current.status).toBe('unavailable');
        expect(result.current.unavailableVisible).toBe(true);
    });

    it('opens the trigger dialog when status is idle and confirms into the preparing modal', () => {
        const trigger = vi.fn();
        mockUseShareable.mockReturnValue(baseReg({ status: 'idle', trigger }));
        const { result } = renderHook(() => useShareFlow(), { wrapper });

        act(() => result.current.onClick());
        expect(result.current.triggerDialogOpen).toBe(true);

        act(() => result.current.onTriggerConfirm());
        expect(trigger).toHaveBeenCalledTimes(1);
        expect(result.current.triggerDialogOpen).toBe(false);
        expect(result.current.preparingOpen).toBe(true);
    });

    it('cancelling the trigger dialog closes it without calling trigger()', () => {
        const trigger = vi.fn();
        mockUseShareable.mockReturnValue(baseReg({ status: 'idle', trigger }));
        const { result } = renderHook(() => useShareFlow(), { wrapper });

        act(() => result.current.onClick());
        act(() => result.current.onTriggerCancel());

        expect(trigger).not.toHaveBeenCalled();
        expect(result.current.triggerDialogOpen).toBe(false);
    });

    it('opens the preparing modal directly when status is already pending', () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'pending' }));
        const { result } = renderHook(() => useShareFlow(), { wrapper });

        act(() => result.current.onClick());

        expect(result.current.preparingOpen).toBe(true);
        expect(result.current.triggerDialogOpen).toBe(false);
    });

    it('shows the error phase in the preparing modal once the user has triggered and the result errored', () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'error' }));
        const { result } = renderHook(() => useShareFlow(), { wrapper });

        // 'error' status routes through the trigger-dialog path first.
        act(() => result.current.onClick());
        act(() => result.current.onTriggerConfirm());

        expect(result.current.preparingPhase).toBe('error');
    });

    it('runs the share flow on click when status is success and opens the sheet with the resulting URL (desktop fallback)', async () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        mockCreateShareSnapshot.mockResolvedValue({ ok: true, id: 'abc123' });

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());

        await waitFor(() => expect(result.current.sheetOpen).toBe(true));
        expect(result.current.shareUrl).toContain('/share/abc123');
        expect(mockCreateShareSnapshot).toHaveBeenCalledWith(
            expect.objectContaining({ kind: 'chart', symbol: 'AAPL' })
        );
    });

    it('auto-advances and shares once a pending registration transitions to success', async () => {
        mockCreateShareSnapshot.mockResolvedValue({ ok: true, id: 'auto1' });
        mockUseShareable.mockReturnValue(baseReg({ status: 'pending' }));

        const { result, rerender } = renderHook(() => useShareFlow(), {
            wrapper,
        });

        // Enter the preparing flow via the pending click path.
        act(() => result.current.onClick());
        expect(result.current.preparingOpen).toBe(true);

        // Registration transitions to success (e.g. background polling completes).
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        rerender();

        await waitFor(() => expect(mockCreateShareSnapshot).toHaveBeenCalled());
    });

    it('uses the native share sheet and swallows AbortError when the user cancels the OS sheet', async () => {
        const shareMock = vi
            .fn()
            .mockRejectedValue(new DOMException('cancelled', 'AbortError'));
        Object.defineProperty(navigator, 'share', {
            value: shareMock,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(window, 'matchMedia', {
            value: vi.fn().mockReturnValue({ matches: true }),
            configurable: true,
            writable: true,
        });
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        mockCreateShareSnapshot.mockResolvedValue({ ok: true, id: 'nat1' });

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());

        await waitFor(() => expect(shareMock).toHaveBeenCalled());
        // AbortError → dismiss quietly, no fallback sheet.
        await waitFor(() => expect(result.current.preparingOpen).toBe(false));
        expect(result.current.sheetOpen).toBe(false);
    });

    it('shares natively and dismisses the preparing modal without opening the sheet on success', async () => {
        const shareMock = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'share', {
            value: shareMock,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(window, 'matchMedia', {
            value: vi.fn().mockReturnValue({ matches: true }),
            configurable: true,
            writable: true,
        });
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        mockCreateShareSnapshot.mockResolvedValue({ ok: true, id: 'nat3' });

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());

        await waitFor(() => expect(shareMock).toHaveBeenCalled());
        await waitFor(() => expect(result.current.preparingOpen).toBe(false));
        expect(result.current.sheetOpen).toBe(false);
    });

    it('falls back to the ShareSheet when native share throws a non-abort error', async () => {
        const shareMock = vi.fn().mockRejectedValue(new Error('boom'));
        Object.defineProperty(navigator, 'share', {
            value: shareMock,
            configurable: true,
            writable: true,
        });
        Object.defineProperty(window, 'matchMedia', {
            value: vi.fn().mockReturnValue({ matches: true }),
            configurable: true,
            writable: true,
        });
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        mockCreateShareSnapshot.mockResolvedValue({ ok: true, id: 'nat2' });

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());

        await waitFor(() => expect(result.current.sheetOpen).toBe(true));
    });

    it('dismisses the preparing modal on an action-level failure (e.g. rate_limited)', async () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        mockCreateShareSnapshot.mockResolvedValue({
            ok: false,
            code: 'rate_limited',
        });

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());

        await waitFor(() => expect(result.current.preparingOpen).toBe(false));
        expect(result.current.sheetOpen).toBe(false);
        expect(result.current.shareUrl).toBeNull();
    });

    it('dismisses the preparing modal on an unexpected network throw', async () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        mockCreateShareSnapshot.mockRejectedValue(new Error('network down'));

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());

        await waitFor(() => expect(result.current.preparingOpen).toBe(false));
    });

    it('ignores clicks while a share mutation is already in flight', async () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        let resolveShare: (v: { ok: true; id: string }) => void = () => {};
        mockCreateShareSnapshot.mockReturnValue(
            new Promise(resolve => {
                resolveShare = resolve;
            })
        );

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());
        await waitFor(() => expect(result.current.isMutating).toBe(true));

        act(() => result.current.onClick());
        expect(mockCreateShareSnapshot).toHaveBeenCalledTimes(1);

        act(() => resolveShare({ ok: true, id: 'ignored-double-click' }));
        await waitFor(() => expect(result.current.isMutating).toBe(false));
    });

    it('resets sheet/dialog/notice state when the active registration switches to a different kind', () => {
        mockUseShareable.mockReturnValue(null);
        const { result, rerender } = renderHook(() => useShareFlow(), {
            wrapper,
        });
        act(() => result.current.onClick());
        expect(result.current.unavailableVisible).toBe(true);

        mockUseShareable.mockReturnValue(
            baseReg({ kind: 'news', status: 'idle' })
        );
        rerender();

        expect(result.current.unavailableVisible).toBe(false);
        expect(result.current.triggerDialogOpen).toBe(false);
    });

    it('closing the sheet returns focus to the trigger button and clears sheetOpen', async () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'success' }));
        mockCreateShareSnapshot.mockResolvedValue({ ok: true, id: 'close1' });

        const { result } = renderHook(() => useShareFlow(), { wrapper });
        act(() => result.current.onClick());
        await waitFor(() => expect(result.current.sheetOpen).toBe(true));

        act(() => result.current.onSheetClose());
        expect(result.current.sheetOpen).toBe(false);
    });

    it('closing the preparing modal resets hasTriggered so a later success does not auto-share', async () => {
        mockUseShareable.mockReturnValue(baseReg({ status: 'pending' }));
        const { result } = renderHook(() => useShareFlow(), { wrapper });

        act(() => result.current.onClick());
        expect(result.current.preparingOpen).toBe(true);

        act(() => result.current.onPreparingClose());
        expect(result.current.preparingOpen).toBe(false);
    });

    it('retrying from the preparing modal re-triggers the registration', () => {
        const trigger = vi.fn();
        mockUseShareable.mockReturnValue(baseReg({ status: 'error', trigger }));
        const { result } = renderHook(() => useShareFlow(), { wrapper });

        act(() => result.current.onPreparingRetry());
        expect(trigger).toHaveBeenCalledTimes(1);
    });
});
