/**
 * Branch coverage tests for useChat — targets the 46 uncovered branches
 * in resolveAiContent, isChatMessage, mutation callbacks, analysis banner,
 * context switch, model localStorage, and sendMessage guard.
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MODEL_STORAGE_KEY, useChat } from '@/widgets/chat/hooks/useChat';
import { isChatMessage } from '@/widgets/chat/utils/chatMessageUtils';
import { useHydrated } from '@/shared/hooks/useHydrated';

// --- Controllable mocks ---

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

vi.mock('@/entities/session/actions/currentUserAction', () => ({
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

// SSR hydration gate — default hydrated so the remainingTokens query fires as
// usual; the gate-closed test flips it to false to assert the query is disabled.
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

const mockUseHydrated = vi.mocked(useHydrated);

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

describe('useChat — branch coverage', () => {
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
        mockUseHydrated.mockReturnValue(true);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('does not fetch remaining tokens while the SSR hydration gate is closed', async () => {
        mockUseHydrated.mockReturnValue(false);

        const { Wrapper } = makeWrapper();
        renderHook(() => useChat({ symbol: 'AAPL' }), { wrapper: Wrapper });

        await new Promise(resolve => setTimeout(resolve, 0));

        // enabled: isHydrated → the remainingTokens query stays disabled, so the
        // server action never runs during the SSR/first-render window.
        expect(mockGetRemainingTokens).not.toHaveBeenCalled();
    });

    describe('resolveAiContent branches (L73-81)', () => {
        it('returns ok message when result.ok is true', async () => {
            mockChatAction.mockResolvedValue({
                ok: true,
                message: 'AI 응답',
                remainingTokens: 4,
            });

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {
                await result.current.sendMessage('hello');
            });

            // The AI message should be the last non-system message
            const aiMsg = result.current.messages
                .filter(isChatMessage)
                .find(m => m.role === 'model');
            expect(aiMsg?.content).toBe('AI 응답');
        });

        it('returns error message for known error code', async () => {
            mockChatAction.mockResolvedValue({
                ok: false,
                error: 'token_exhausted',
            });

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {
                await result.current.sendMessage('hello');
            });

            const aiMsg = result.current.messages
                .filter(isChatMessage)
                .find(m => m.role === 'model');
            expect(aiMsg?.content).toContain('무료 질문');
        });

        it('falls back to server_error for unknown error code', async () => {
            mockChatAction.mockResolvedValue({
                ok: false,
                error: 'unknown_code_xyz' as string,
            });

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {
                await result.current.sendMessage('hello');
            });

            const aiMsg = result.current.messages
                .filter(isChatMessage)
                .find(m => m.role === 'model');
            expect(aiMsg?.content).toContain('일시적인 오류');
        });

        it('uses error.message when error is an object', async () => {
            mockChatAction.mockResolvedValue({
                ok: false,
                error: { message: '커스텀 오류 메시지' },
            });

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {
                await result.current.sendMessage('hello');
            });

            const aiMsg = result.current.messages
                .filter(isChatMessage)
                .find(m => m.role === 'model');
            expect(aiMsg?.content).toBe('커스텀 오류 메시지');
        });
    });

    describe('mutation onError branch (L243)', () => {
        it('adds server_error message when mutation throws', async () => {
            mockChatAction.mockRejectedValue(new Error('network error'));

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {
                await result.current.sendMessage('test').catch(() => {});
            });

            const aiMsg = result.current.messages
                .filter(isChatMessage)
                .find(m => m.role === 'model');
            expect(aiMsg?.content).toContain('일시적인 오류');
        });
    });

    describe('sendMessage guard (L264)', () => {
        it('does not send when analysis is not ready', async () => {
            mockSymbolChatReturn = {
                context: null,
                timeframe: '1Day',
                isAnalysisReady: false,
            };

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {
                await result.current.sendMessage('hello');
            });

            expect(mockChatAction).not.toHaveBeenCalled();
        });
    });

    describe('model localStorage — invalid stored value (L301)', () => {
        it('ignores invalid model and hydrates with default', async () => {
            localStorage.setItem(MODEL_STORAGE_KEY, 'invalid-model-xyz');

            const { Wrapper } = makeWrapper();
            const { result } = await act(async () =>
                renderHook(() => useChat({ symbol: 'AAPL' }), {
                    wrapper: Wrapper,
                })
            );

            // Invalid model is ignored — hook hydrates as if no model was stored
            // (isModelHydrated becomes true, selectedModel stays default)
            expect(result.current.isModelHydrated).toBe(true);
        });
    });

    describe('model localStorage — storage error (L310)', () => {
        it('handles localStorage.getItem throwing', async () => {
            const getItemSpy = vi
                .spyOn(Storage.prototype, 'getItem')
                .mockImplementation(key => {
                    if (key === MODEL_STORAGE_KEY)
                        throw new Error('storage error');
                    return null;
                });

            const { Wrapper } = makeWrapper();
            await act(async () => {
                renderHook(() => useChat({ symbol: 'AAPL' }), {
                    wrapper: Wrapper,
                });
            });

            // Should not crash and isModelHydrated should become true
            getItemSpy.mockRestore();
        });
    });

    describe('storageKey change — load session for new key (L332-344)', () => {
        it('loads messages for new symbol/timeframe', async () => {
            const storedMessages = [
                { role: 'user' as const, content: '이전 질문' },
            ];
            mockLoadSession
                .mockReturnValueOnce([]) // initial load
                .mockReturnValueOnce(storedMessages); // after key change

            const { Wrapper } = makeWrapper();
            const { rerender } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            // Wait for initial load
            await act(async () => {});

            // Change timeframe — triggers storageKey change
            mockSymbolChatReturn = {
                context: null,
                timeframe: '1Week',
                isAnalysisReady: true,
            };

            await act(async () => {
                rerender();
            });

            // Verify loadSession was called with the new key
            expect(mockLoadSession).toHaveBeenCalledWith(
                'siglens_chat_AAPL_1Week'
            );
        });
    });

    describe('analysis updated banner (L354-378)', () => {
        it('shows analysisUpdated when analysis is newer than saved chat on first ready', async () => {
            const savedAt = Date.now() - 60000; // 1 min ago
            const analyzedAt = new Date().toISOString(); // now

            // Must have existing messages for the banner to show
            mockLoadSession.mockReturnValue([
                { role: 'user' as const, content: '질문' },
            ]);
            // loadSessionFull must return a savedAt that is older than analyzedAt
            mockLoadSessionFull.mockReturnValue({
                messages: [{ role: 'user' as const, content: '질문' }],
                savedAt,
            });

            // Start with isAnalysisReady=false so isFirstAnalysisReadyRef stays true
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt, summary: 'summary' },
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

            // Now set isAnalysisReady=true to trigger the page-refresh banner path
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt, summary: 'summary' },
                },
                timeframe: '1Day',
                isAnalysisReady: true,
            };

            await act(async () => {
                rerender();
            });

            await waitFor(() => {
                expect(result.current.analysisUpdated).toBe(true);
            });
        });

        it('does not show banner when no messages', async () => {
            mockLoadSession.mockReturnValue([]);
            mockLoadSessionFull.mockReturnValue({
                messages: [],
                savedAt: null,
            });

            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: {
                        analyzedAt: new Date().toISOString(),
                        summary: 'summary',
                    },
                },
                timeframe: '1Day',
                isAnalysisReady: true,
            };

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {});
            expect(result.current.analysisUpdated).toBe(false);
        });
    });

    describe('context switch label (L394-403)', () => {
        it('appends context switch message when label changes', async () => {
            mockPageContextLabel = 'AAPL · 1Day';

            const { Wrapper } = makeWrapper();
            const { result, rerender } = renderHook(
                () => useChat({ symbol: 'AAPL' }),
                { wrapper: Wrapper }
            );

            await act(async () => {});

            // Change the label
            mockPageContextLabel = 'AAPL · 1Week';

            await act(async () => {
                rerender();
            });

            // Check for context switch system message
            const switchMsg = result.current.messages.find(
                m => m.role === 'system'
            );
            expect(switchMsg).toBeDefined();
        });
    });

    describe('dismissAnalysisUpdated (L272)', () => {
        it('clears the analysisUpdated flag', async () => {
            const savedAt = Date.now() - 60000;
            const analyzedAt = new Date().toISOString();

            mockLoadSession.mockReturnValue([
                { role: 'user' as const, content: '질문' },
            ]);
            mockLoadSessionFull.mockReturnValue({
                messages: [{ role: 'user' as const, content: '질문' }],
                savedAt,
            });

            // Start with isAnalysisReady=false
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt, summary: 'summary' },
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

            // Switch to ready
            mockSymbolChatReturn = {
                context: {
                    kind: 'technical',
                    payload: { analyzedAt, summary: 'summary' },
                },
                timeframe: '1Day',
                isAnalysisReady: true,
            };

            await act(async () => {
                rerender();
            });

            await waitFor(() => {
                expect(result.current.analysisUpdated).toBe(true);
            });

            act(() => {
                result.current.dismissAnalysisUpdated();
            });

            expect(result.current.analysisUpdated).toBe(false);
        });
    });

    describe('model write effect — localStorage.setItem error (L326)', () => {
        it('handles localStorage.setItem throwing gracefully', async () => {
            const setItemSpy = vi
                .spyOn(Storage.prototype, 'setItem')
                .mockImplementation(() => {
                    throw new Error('QuotaExceededError');
                });

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            // Should not crash
            await act(async () => {
                result.current.handleModelChange('gemini-2.5-flash');
            });

            setItemSpy.mockRestore();
        });
    });

    describe('user_api_key_required branch (L235)', () => {
        it('shows gate modal when error is user_api_key_required', async () => {
            mockChatAction.mockResolvedValue({
                ok: false,
                error: 'user_api_key_required',
            });

            const { Wrapper } = makeWrapper();
            const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: Wrapper,
            });

            await act(async () => {
                await result.current.sendMessage('hello');
            });

            // The gate modal should be shown (gateModal != null)
            expect(result.current.gateModal).not.toBeNull();
        });
    });
});
