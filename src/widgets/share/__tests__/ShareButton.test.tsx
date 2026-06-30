/**
 * ShareButton tests (C-4 + base spec §9-1 + addendum C-4).
 *
 * Provider setup: wrap in ShareableAnalysisProvider + QueryClientProvider.
 * useShareable is mocked so we can control reg directly without a full provider tree.
 * useUserTier is mocked to return { tier: 'free', isLoading: false }.
 * createShareSnapshotAction is mocked to return { ok: true, id: 'abc' }.
 * @/shared/lib/share — canShareNatively stubbed to false (desktop path) so ShareSheet appears.
 * @/shared/lib/seo  — SITE_URL stubbed to 'https://siglens.io'.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ShareButton } from '../ui/ShareButton';

const { mockAction, mockUseShareable, mockCanShareNatively } = vi.hoisted(
    () => ({
        mockAction: vi.fn(),
        mockUseShareable: vi.fn(),
        mockCanShareNatively: vi.fn(() => false),
    })
);

vi.mock('@/entities/shared-analysis/actions/createShareSnapshotAction', () => ({
    createShareSnapshotAction: mockAction,
}));

vi.mock('@/features/share', async importOriginal => {
    const original = await importOriginal<typeof import('@/features/share')>();
    return {
        ...original,
        useShareable: mockUseShareable,
    };
});

vi.mock('@/features/symbol-model/hooks/useUserTier', () => ({
    useUserTier: vi.fn(() => ({ tier: 'free', isLoading: false })),
}));

vi.mock('@/shared/lib/share', () => ({
    canShareNatively: mockCanShareNatively,
    isShareAbort: (err: unknown) =>
        err instanceof DOMException &&
        (err as DOMException).name === 'AbortError',
    buildTweetIntentUrl: ({
        text,
        shareUrl,
    }: {
        text: string;
        shareUrl: string;
    }) =>
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`,
}));

vi.mock('@/shared/lib/seo', () => ({
    SITE_URL: 'https://siglens.io',
}));

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}

const baseContext = {
    symbol: 'AAPL',
    displayName: 'Apple Inc.',
    assetClass: 'us_equity',
};

function makeReg(
    status: 'success' | 'idle' | 'pending' | 'error' | 'unavailable',
    result: unknown = { trend: 'bullish', summary: '상승 추세' }
) {
    return {
        kind: 'chart' as const,
        status,
        result: status === 'success' ? result : null,
        context: baseContext,
        trigger: vi.fn(),
    };
}

function renderButton() {
    return render(<ShareButton />, { wrapper: Wrapper });
}

beforeEach(() => {
    queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    });
    vi.clearAllMocks();
    mockAction.mockResolvedValue({ ok: true, id: 'abc' });
    mockCanShareNatively.mockReturnValue(false);
});

afterEach(() => {
    queryClient.clear();
});

describe('ShareButton', () => {
    it('has aria-label "분석 결과 공유"', () => {
        mockUseShareable.mockReturnValue(null);
        renderButton();
        expect(
            screen.getByRole('button', { name: '분석 결과 공유' })
        ).toBeInTheDocument();
    });

    describe('status === "success"', () => {
        it('calls createShareSnapshotAction on click', async () => {
            mockUseShareable.mockReturnValue(makeReg('success'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
        });

        it('opens ShareSheet when canShareNatively is false and action returns ok', async () => {
            mockUseShareable.mockReturnValue(makeReg('success'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            // ShareSheet has a dialog role with the symbol name in its aria-label.
            await waitFor(() =>
                expect(
                    screen.getByRole('dialog', { name: /AAPL AI 분석 결과/ })
                ).toBeInTheDocument()
            );
        });

        it('sets aria-busy="true" while mutation is pending', async () => {
            // Make the action hang so we can observe the loading state.
            let resolveAction!: (v: { ok: true; id: string }) => void;
            mockAction.mockReturnValue(
                new Promise<{ ok: true; id: string }>(res => {
                    resolveAction = res;
                })
            );
            mockUseShareable.mockReturnValue(makeReg('success'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            // aria-busy should be set before the promise resolves.
            await waitFor(() =>
                expect(
                    screen.getByRole('button', { name: '분석 결과 공유' })
                ).toHaveAttribute('aria-busy', 'true')
            );
            // Clean up: resolve so no unhandled promise warning.
            resolveAction({ ok: true, id: 'abc' });
        });
    });

    describe('status === "idle"', () => {
        it('opens ShareTriggerDialog on click', () => {
            mockUseShareable.mockReturnValue(makeReg('idle'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            expect(
                screen.getByRole('dialog', {
                    name: '공유하기 전에 분석을 준비할게요',
                })
            ).toBeInTheDocument();
        });
    });

    describe('status === "pending"', () => {
        it('opens SharePreparingModal on click', () => {
            mockUseShareable.mockReturnValue(makeReg('pending'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            expect(
                screen.getByRole('dialog', { name: '분석 준비 중' })
            ).toBeInTheDocument();
        });
    });

    describe('status === "unavailable"', () => {
        it('shows inline notice on click without disabling the button (C-4)', () => {
            mockUseShareable.mockReturnValue(makeReg('unavailable'));
            renderButton();
            const btn = screen.getByRole('button', { name: '분석 결과 공유' });

            // Button must NOT be disabled while unavailable.
            expect(btn).not.toBeDisabled();

            fireEvent.click(btn);

            expect(
                screen.getByText('이 탭은 공유할 분석이 아직 없어요')
            ).toBeInTheDocument();
        });

        it('button is not disabled when unavailable (explicit assertion, C-4)', () => {
            mockUseShareable.mockReturnValue(makeReg('unavailable'));
            renderButton();
            expect(
                screen.getByRole('button', { name: '분석 결과 공유' })
            ).not.toBeDisabled();
        });

        it('aria-describedby points to the notice element after click (C-4)', () => {
            mockUseShareable.mockReturnValue(makeReg('unavailable'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );

            const btn = screen.getByRole('button', { name: '분석 결과 공유' });
            const describedById = btn.getAttribute('aria-describedby');
            expect(describedById).toBeTruthy();

            const notice = document.getElementById(describedById!);
            expect(notice).toBeInTheDocument();
            expect(notice).toHaveTextContent(
                '이 탭은 공유할 분석이 아직 없어요'
            );
        });
    });

    describe('reg === null (no Provider registration) — treated as unavailable (C-4)', () => {
        it('shows inline notice on click when reg is null', () => {
            mockUseShareable.mockReturnValue(null);
            renderButton();
            const btn = screen.getByRole('button', { name: '분석 결과 공유' });
            expect(btn).not.toBeDisabled();
            fireEvent.click(btn);
            expect(
                screen.getByText('이 탭은 공유할 분석이 아직 없어요')
            ).toBeInTheDocument();
        });

        it('button is not disabled when reg is null', () => {
            mockUseShareable.mockReturnValue(null);
            renderButton();
            expect(
                screen.getByRole('button', { name: '분석 결과 공유' })
            ).not.toBeDisabled();
        });
    });

    // R2-1: auto-advance (preparing flow)
    describe('auto-advance: pending → success', () => {
        it('opens SharePreparingModal when status=pending and click, then calls mutation when status advances to success', async () => {
            const reg = makeReg('pending');
            mockUseShareable.mockReturnValue(reg);
            const { rerender } = renderButton();

            // Click with pending → modal should open.
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            expect(
                screen.getByRole('dialog', { name: '분석 준비 중' })
            ).toBeInTheDocument();

            // Simulate analysis completing: status transitions to 'success'.
            mockUseShareable.mockReturnValue(makeReg('success'));
            // rerender must receive just the unwrapped element — the wrapper from
            // renderButton() is applied automatically by RTL.
            rerender(<ShareButton />);

            // Auto-advance effect fires → mutation called → sheet appears.
            await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
            await waitFor(() =>
                expect(
                    screen.getByRole('dialog', { name: /AAPL AI 분석 결과/ })
                ).toBeInTheDocument()
            );
        });

        it('switches preparing modal to error phase when status transitions to error', async () => {
            mockUseShareable.mockReturnValue(makeReg('pending'));
            const { rerender } = renderButton();

            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            expect(
                screen.getByRole('dialog', { name: '분석 준비 중' })
            ).toBeInTheDocument();

            // Simulate analysis error.
            mockUseShareable.mockReturnValue(makeReg('error'));
            rerender(<ShareButton />);

            // Modal switches to error phase — no mutation called, title changes.
            await waitFor(() => expect(mockAction).not.toHaveBeenCalled());
            await waitFor(() =>
                expect(
                    screen.getByRole('dialog', { name: '분석 실패' })
                ).toBeInTheDocument()
            );
        });
    });

    describe('auto-advance: idle → confirm → success', () => {
        it('opens dialog on idle click, confirms → trigger called + preparing modal; then advances to share on success', async () => {
            const idleReg = makeReg('idle');
            mockUseShareable.mockReturnValue(idleReg);
            const { rerender } = renderButton();

            // Click idle → dialog opens.
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            expect(
                screen.getByRole('dialog', {
                    name: '공유하기 전에 분석을 준비할게요',
                })
            ).toBeInTheDocument();

            // Confirm → trigger called, preparing modal opens.
            fireEvent.click(
                screen.getByRole('button', { name: '분석하고 공유하기' })
            );
            expect(idleReg.trigger).toHaveBeenCalledTimes(1);
            expect(
                screen.getByRole('dialog', { name: '분석 준비 중' })
            ).toBeInTheDocument();

            // Simulate analysis completing.
            mockUseShareable.mockReturnValue(makeReg('success'));
            rerender(<ShareButton />);

            // Auto-advance fires → createShareSnapshotAction called.
            await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
            await waitFor(() =>
                expect(
                    screen.getByRole('dialog', { name: /AAPL AI 분석 결과/ })
                ).toBeInTheDocument()
            );
        });
    });

    // R3-1: native-share no-double-fire (mobile auto-advance)
    describe('native-share: auto-advance no-double-fire', () => {
        it('pending → click (preparing modal opens) → success: native share called once, modal closed, second rerender does not re-fire', async () => {
            // Set up a navigator.share that resolves immediately.
            const shareFn = vi.fn().mockResolvedValue(undefined);
            vi.stubGlobal('navigator', { share: shareFn });
            mockCanShareNatively.mockReturnValue(true);

            // Start with status='pending' (already polling).
            const pendingReg = makeReg('pending');
            mockUseShareable.mockReturnValue(pendingReg);
            const { rerender } = renderButton();

            // Click with pending → preparing modal opens.
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            expect(
                screen.getByRole('dialog', { name: '분석 준비 중' })
            ).toBeInTheDocument();

            // Advance status to 'success' → auto-advance effect fires → mutation → native share.
            mockUseShareable.mockReturnValue(makeReg('success'));
            rerender(<ShareButton />);

            await waitFor(() => expect(shareFn).toHaveBeenCalledTimes(1));

            // Preparing modal must be closed after native share completes.
            await waitFor(() =>
                expect(
                    screen.queryByRole('dialog', { name: '분석 준비 중' })
                ).not.toBeInTheDocument()
            );

            // Second rerender with same 'success' result (simulates provider identity change).
            // hasTriggered must now be false → auto-advance effect must NOT re-fire.
            rerender(<ShareButton />);

            // Allow any pending micro-tasks to flush.
            await waitFor(() => expect(shareFn).toHaveBeenCalledTimes(1));

            vi.unstubAllGlobals();
        });

        it('native-share AbortError: preparing modal is closed and does not re-fire', async () => {
            const abortErr = new DOMException('cancelled', 'AbortError');
            const shareFn = vi.fn().mockRejectedValue(abortErr);
            vi.stubGlobal('navigator', { share: shareFn });
            mockCanShareNatively.mockReturnValue(true);

            const pendingReg = makeReg('pending');
            mockUseShareable.mockReturnValue(pendingReg);
            const { rerender } = renderButton();

            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            expect(
                screen.getByRole('dialog', { name: '분석 준비 중' })
            ).toBeInTheDocument();

            mockUseShareable.mockReturnValue(makeReg('success'));
            rerender(<ShareButton />);

            await waitFor(() => expect(shareFn).toHaveBeenCalledTimes(1));

            // Modal must close even on AbortError.
            await waitFor(() =>
                expect(
                    screen.queryByRole('dialog', { name: '분석 준비 중' })
                ).not.toBeInTheDocument()
            );

            // No double-fire on subsequent rerender.
            rerender(<ShareButton />);
            await waitFor(() => expect(shareFn).toHaveBeenCalledTimes(1));

            vi.unstubAllGlobals();
        });
    });

    // T2: onSuccess branch tree
    describe('onSuccess branch tree', () => {
        it('does not open ShareSheet when action returns ok:false', async () => {
            mockAction.mockResolvedValue({ ok: false, code: 'rate_limited' });
            mockUseShareable.mockReturnValue(makeReg('success'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            await waitFor(() => expect(mockAction).toHaveBeenCalledTimes(1));
            // ShareSheet dialog must NOT appear.
            expect(
                screen.queryByRole('dialog', { name: /AAPL AI 분석 결과/ })
            ).not.toBeInTheDocument();
        });

        it('calls navigator.share when canShareNatively is true and share resolves', async () => {
            const shareFn = vi.fn().mockResolvedValue(undefined);
            vi.stubGlobal('navigator', { share: shareFn });
            mockCanShareNatively.mockReturnValue(true);
            mockUseShareable.mockReturnValue(makeReg('success'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            await waitFor(() => expect(shareFn).toHaveBeenCalledTimes(1));
            // ShareSheet must NOT be opened when native share succeeds.
            expect(
                screen.queryByRole('dialog', { name: /AAPL AI 분석 결과/ })
            ).not.toBeInTheDocument();
            vi.unstubAllGlobals();
        });

        it('swallows AbortError silently when navigator.share rejects with AbortError', async () => {
            const abortErr = new DOMException('cancelled', 'AbortError');
            const shareFn = vi.fn().mockRejectedValue(abortErr);
            vi.stubGlobal('navigator', { share: shareFn });
            mockCanShareNatively.mockReturnValue(true);
            mockUseShareable.mockReturnValue(makeReg('success'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            await waitFor(() => expect(shareFn).toHaveBeenCalledTimes(1));
            // No ShareSheet on abort.
            expect(
                screen.queryByRole('dialog', { name: /AAPL AI 분석 결과/ })
            ).not.toBeInTheDocument();
            vi.unstubAllGlobals();
        });

        it('falls back to ShareSheet when navigator.share rejects with non-abort error', async () => {
            const nonAbortErr = new Error('Network error');
            const shareFn = vi.fn().mockRejectedValue(nonAbortErr);
            vi.stubGlobal('navigator', { share: shareFn });
            mockCanShareNatively.mockReturnValue(true);
            mockUseShareable.mockReturnValue(makeReg('success'));
            renderButton();
            fireEvent.click(
                screen.getByRole('button', { name: '분석 결과 공유' })
            );
            // Should open ShareSheet after non-abort rejection.
            await waitFor(() =>
                expect(
                    screen.getByRole('dialog', { name: /AAPL AI 분석 결과/ })
                ).toBeInTheDocument()
            );
            vi.unstubAllGlobals();
        });
    });
});
