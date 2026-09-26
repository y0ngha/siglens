/**
 * Further branch coverage for useChat — targets the loadingPhase timer
 * transition, the sendMessage in-flight guard, the llmMessages history
 * filter, the analysis-updated banner's remaining branches (no savedAt,
 * chat newer than analysis, live re-analysis after first-ready), the
 * context-switch no-op path, and the phase-timer unmount cleanup.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useChat } from '@/widgets/chat/hooks/useChat';

const mockChatAction = vi.fn();
const mockGetRemainingTokens = vi.fn().mockResolvedValue(5);

let mockSymbolChatReturn = {
    context: null as null | {
        kind: string;
        payload: { analyzedAt: string; summary: string };
    },
    timeframe: '1Day' as string | undefined,
    isAnalysisReady: true,
};

let mockPageContextLabel: string | null = null;

vi.mock('@/features/symbol-chat', () => ({
    useSymbolChat: () => mockSymbolChatReturn,
}));

vi.mock('@/widgets/chat/hooks/usePageContextLabel', () => ({
    usePageContextLabel: () => mockPageContextLabel,
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: () => ({ name: 'Apple Inc.' }),
}));

vi.mock('@/entities/chat-message/actions', () => ({
    chatAction: (...args: unknown[]) => mockChatAction(...args),
    getRemainingTokensAction: () => mockGetRemainingTokens(),
}));

vi.mock('@/entities/auth/actions/currentUserAction', () => ({
    currentUserAction: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/entities/api-key/actions', () => ({
    getRegisteredProvidersAction: vi.fn().mockResolvedValue([]),
}));

const mockLoadSession = vi.fn().mockReturnValue([]);
const mockLoadSessionFull = vi
    .fn()
    .mockReturnValue({ messages: [], savedAt: null });
const mockSaveSession = vi.fn();

vi.mock('@/widgets/chat/utils/chatStorage', () => ({
    buildStorageKey: (symbol: string, tf: string) =>
        `siglens_chat_${symbol.toUpperCase()}_${tf}`,
    loadSession: (...args: unknown[]) => mockLoadSession(...args),
    loadSessionFull: (...args: unknown[]) => mockLoadSessionFull(...args),
    saveSession: (...args: unknown[]) => mockSaveSession(...args),
}));

vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
        },
    });
    return {
        client,
        Wrapper({ children }: { children: React.ReactNode }) {
            return (
                <QueryClientProvider client={client}>
                    {children}
                </QueryClientProvider>
            );
        },
    };
}

describe('useChat — further branch coverage', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        mockSymbolChatReturn = {
            context: null,
            timeframe: '1Day',
            isAnalysisReady: true,
        };
        mockPageContextLabel = null;
        mockLoadSession.mockReturnValue([]);
        mockLoadSessionFull.mockReturnValue({ messages: [], savedAt: null });
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('loadingPhase transitions from analyzing to generating after the minimum display duration', async () => {
        vi.useFakeTimers();
        let resolveChat!: (value: {
            ok: true;
            message: string;
            remainingTokens: number;
        }) => void;
        mockChatAction.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveChat = resolve;
                })
        );

        const { Wrapper } = makeWrapper();
        const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
            wrapper: Wrapper,
        });

        await act(async () => {
            void result.current.sendMessage('hello');
            await Promise.resolve();
        });
        expect(result.current.loadingPhase).toBe('analyzing');

        act(() => {
            vi.advanceTimersByTime(1500);
        });
        expect(result.current.loadingPhase).toBe('generating');

        await act(async () => {
            resolveChat({ ok: true, message: '답', remainingTokens: 4 });
            await Promise.resolve();
        });
    });

    it('ignores a second sendMessage while one is already in flight', async () => {
        let resolveChat!: (value: {
            ok: true;
            message: string;
            remainingTokens: number;
        }) => void;
        mockChatAction.mockImplementation(
            () =>
                new Promise(resolve => {
                    resolveChat = resolve;
                })
        );

        const { Wrapper } = makeWrapper();
        const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
            wrapper: Wrapper,
        });

        act(() => {
            void result.current.sendMessage('first');
        });
        await waitFor(() =>
            expect(result.current.loadingPhase).toBe('analyzing')
        );

        // Fired while the first call is still in flight — must be a no-op.
        await act(async () => {
            await result.current.sendMessage('second, ignored');
        });
        expect(mockChatAction).toHaveBeenCalledTimes(1);

        await act(async () => {
            resolveChat({ ok: true, message: '답', remainingTokens: 4 });
            await Promise.resolve();
        });
    });

    it('forwards prior user/model turns (but not system messages) as history on the next send', async () => {
        mockChatAction.mockResolvedValue({
            ok: true,
            message: '두번째 답',
            remainingTokens: 4,
        });
        mockPageContextLabel = 'AAPL · 1Day';

        const { Wrapper } = makeWrapper();
        const { result, rerender } = renderHook(
            () => useChat({ symbol: 'AAPL' }),
            { wrapper: Wrapper }
        );
        await act(async () => {});

        await act(async () => {
            await result.current.sendMessage('첫 질문');
        });

        // Trigger a context-switch system message so history contains a
        // non-chat entry that the flatMap filter must drop.
        mockPageContextLabel = 'AAPL · 1Week';
        await act(async () => {
            rerender();
        });
        expect(result.current.messages.some(m => m.role === 'system')).toBe(
            true
        );

        await act(async () => {
            await result.current.sendMessage('둘째 질문');
        });

        const [, secondCallArgs] = mockChatAction.mock.calls;
        // chatAction(symbol, companyName, timeframe, analysis, currentMessages, text, ...)
        const currentMessages = secondCallArgs![4] as Array<{
            role: string;
            content: string;
        }>;
        expect(currentMessages.every(m => m.role !== 'system')).toBe(true);
        expect(currentMessages.map(m => m.content)).toEqual([
            '첫 질문',
            '두번째 답',
        ]);
    });

    describe('analysis-updated banner — remaining branches', () => {
        it('no banner when there is no saved session timestamp (savedAt null) even with existing messages', async () => {
            mockLoadSession.mockReturnValue([
                { role: 'user' as const, content: '질문' },
            ]);
            mockLoadSessionFull.mockReturnValue({
                messages: [{ role: 'user' as const, content: '질문' }],
                savedAt: null,
            });
            // Starts NOT ready — mirrors the passing "page-refresh" test — so the
            // effect re-runs (and its messages/analysis deps are fully hydrated)
            // once isAnalysisReady flips to true on the rerender below. Starting
            // ready=true here would run the check before the mount effect has
            // finished hydrating `messagesRef`, short-circuiting before ever
            // reaching the savedAt check this test targets.
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: {
                        analyzedAt: new Date().toISOString(),
                        summary: 's',
                    },
                },
                timeframe: '1Day',
                isAnalysisReady: false,
            };

            const { Wrapper } = makeWrapper();
            const { result, rerender } = renderHook(
                () => useChat({ symbol: 'AAPL' }),
                { wrapper: Wrapper }
            );
            await act(async () => {});

            mockSymbolChatReturn = {
                ...mockSymbolChatReturn,
                isAnalysisReady: true,
            };
            await act(async () => {
                rerender();
            });

            expect(result.current.analysisUpdated).toBe(false);
        });

        it('no banner on first-ready path when the chat is already newer than the analysis', async () => {
            const analyzedAt = new Date(Date.now() - 60_000).toISOString(); // analysis is older
            const savedAt = Date.now(); // chat saved after the analysis

            mockLoadSession.mockReturnValue([
                { role: 'user' as const, content: '질문' },
            ]);
            mockLoadSessionFull.mockReturnValue({
                messages: [{ role: 'user' as const, content: '질문' }],
                savedAt,
            });
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt, summary: 's' },
                },
                timeframe: '1Day',
                isAnalysisReady: false,
            };

            const { Wrapper } = makeWrapper();
            const { result, rerender } = renderHook(
                () => useChat({ symbol: 'AAPL' }),
                { wrapper: Wrapper }
            );
            await act(async () => {});

            mockSymbolChatReturn = {
                ...mockSymbolChatReturn,
                isAnalysisReady: true,
            };
            await act(async () => {
                rerender();
            });

            expect(result.current.analysisUpdated).toBe(false);
        });

        it('live re-analysis path: a second, newer analysis object re-triggers the banner after the first-ready pass already consumed it', async () => {
            const savedAt = Date.now() - 120_000;
            const firstAnalyzedAt = new Date(Date.now() - 60_000).toISOString();
            const secondAnalyzedAt = new Date().toISOString();

            mockLoadSession.mockReturnValue([
                { role: 'user' as const, content: '질문' },
            ]);
            mockLoadSessionFull.mockReturnValue({
                messages: [{ role: 'user' as const, content: '질문' }],
                savedAt,
            });
            // Starts NOT ready so the first-ready path fires on the next render,
            // exactly like the existing "page-refresh" test — then a second,
            // distinct analysis object arrives while already ready.
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt: firstAnalyzedAt, summary: 's1' },
                },
                timeframe: '1Day',
                isAnalysisReady: false,
            };

            const { Wrapper } = makeWrapper();
            const { result, rerender } = renderHook(
                () => useChat({ symbol: 'AAPL' }),
                { wrapper: Wrapper }
            );
            await act(async () => {});

            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt: firstAnalyzedAt, summary: 's1' },
                },
                timeframe: '1Day',
                isAnalysisReady: true,
            };
            await act(async () => {
                rerender();
            });
            await waitFor(() =>
                expect(result.current.analysisUpdated).toBe(true)
            );

            act(() => result.current.dismissAnalysisUpdated());
            expect(result.current.analysisUpdated).toBe(false);

            // A brand-new analysis object (re-analysis while the page stayed open).
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt: secondAnalyzedAt, summary: 's2' },
                },
                timeframe: '1Day',
                isAnalysisReady: true,
            };
            await act(async () => {
                rerender();
            });

            await waitFor(() =>
                expect(result.current.analysisUpdated).toBe(true)
            );
        });
    });

    it('context label unchanged across a rerender does not append a duplicate system message', async () => {
        mockPageContextLabel = 'AAPL · 1Day';

        const { Wrapper } = makeWrapper();
        const { result, rerender } = renderHook(
            () => useChat({ symbol: 'AAPL' }),
            { wrapper: Wrapper }
        );
        await act(async () => {});

        const before = result.current.messages.filter(
            m => m.role === 'system'
        ).length;

        // Rerender with the exact same label — no context switch happened.
        await act(async () => {
            rerender();
        });

        const after = result.current.messages.filter(
            m => m.role === 'system'
        ).length;
        expect(after).toBe(before);
    });

    it('clears the pending phase timer on unmount while a send is still in flight', async () => {
        const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
        mockChatAction.mockImplementation(() => new Promise(() => {}));

        const { Wrapper } = makeWrapper();
        const { result, unmount } = renderHook(
            () => useChat({ symbol: 'AAPL' }),
            { wrapper: Wrapper }
        );

        act(() => {
            void result.current.sendMessage('hello');
        });
        await waitFor(() =>
            expect(result.current.loadingPhase).toBe('analyzing')
        );

        unmount();

        expect(clearTimeoutSpy).toHaveBeenCalled();
    });
});
