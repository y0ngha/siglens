/**
 * Unit tests for `useChat` model persistence (B4 regression guard).
 *
 * Scope: this test file covers ONLY the model-write effect behavior to lock in
 * the open→close→open regression fix. The hook is heavily mocked at the module
 * boundary because its full surface (React Query, server actions, symbol chat
 * context) is unrelated to the specific bug under test.
 */

import { act, renderHook } from '@testing-library/react';
import React from 'react';

// React Query is required by useChat. Provide a minimal client wrapper.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MODEL_STORAGE_KEY } from '@/widgets/chat/hooks/useChat';

// --- Module-level mocks ---------------------------------------------------

vi.mock('@/features/symbol-chat', () => ({
    useSymbolChat: () => ({
        context: null,
        timeframe: '1Day',
        isAnalysisReady: true,
        publish: vi.fn(),
        clear: vi.fn(),
    }),
}));

vi.mock('@/widgets/chat/hooks/usePageContextLabel', () => ({
    usePageContextLabel: () => null,
}));

vi.mock('@/entities/ticker/hooks/useAssetInfo', () => ({
    useAssetInfo: () => ({ name: 'AAPL Inc.' }),
}));

vi.mock('@/entities/chat-message/actions', () => ({
    chatAction: vi.fn(),
    getRemainingTokensAction: vi.fn().mockResolvedValue(5),
}));

vi.mock('@/entities/auth/actions/currentUserAction', () => ({
    currentUserAction: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/entities/api-key/actions', () => ({
    getRegisteredProvidersAction: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/widgets/chat/utils/chatStorage', () => ({
    buildStorageKey: (symbol: string, tf: string) =>
        `siglens_chat_${symbol.toUpperCase()}_${tf}`,
    loadSession: vi.fn().mockReturnValue([]),
    loadSessionFull: vi.fn().mockReturnValue({ messages: [], savedAt: null }),
    saveSession: vi.fn(),
}));

// Import after mocks so the hook picks them up.
import { useChat } from '@/widgets/chat/hooks/useChat';

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
        },
    });
    function TestQueryWrapper({
        children,
    }: {
        children: React.ReactNode;
    }): React.ReactElement {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    }
    return TestQueryWrapper;
}

describe('useChat — model persistence', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
    });

    it('does not overwrite stored model with the default on initial mount', async () => {
        // Pre-existing stored model from a previous session. Deliberately NOT the
        // legacy chat default (`gemini-2.5-flash`) — that exact value now triggers
        // the one-time migration (see the dedicated migration test below), which
        // legitimately writes to MODEL_STORAGE_KEY at mount. This test asserts the
        // unrelated original regression: an arbitrary already-stored selection
        // must never be silently overwritten on mount.
        localStorage.setItem(MODEL_STORAGE_KEY, 'claude-sonnet-4-6');
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

        await act(async () => {
            renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: makeWrapper(),
            });
        });

        // The mount-time write must not happen — the previous default would have
        // clobbered the stored value. We assert no setItem call targeted the
        // model key during mount/hydration.
        const modelWrites = setItemSpy.mock.calls.filter(
            ([key]) => key === MODEL_STORAGE_KEY
        );
        expect(modelWrites).toHaveLength(0);
        setItemSpy.mockRestore();
    });

    it('migrates a legacy gemini-2.5-flash stored chat model to deepseek-v4-flash after mount', async () => {
        // Simulates a pre-DeepSeek-flip user who never touched the model selector:
        // `useChat` used to auto-persist the old chat default, so this exact value
        // is indistinguishable from "never chosen" and must be migrated forward.
        localStorage.setItem(MODEL_STORAGE_KEY, 'gemini-2.5-flash');

        const { result } = await act(async () => {
            return renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: makeWrapper(),
            });
        });

        expect(result.current.selectedModel).toBe('deepseek-v4-flash');
        expect(localStorage.getItem(MODEL_STORAGE_KEY)).toBe(
            'deepseek-v4-flash'
        );
    });

    it('persists model changes after open→close→open (B4 regression)', async () => {
        // First mount: hydrate, then user changes model.
        const first = await act(async () => {
            return renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: makeWrapper(),
            });
        });

        // Simulate a user-initiated model change in the first session.
        await act(async () => {
            first.result.current.handleModelChange('gemini-2.5-flash');
        });
        expect(localStorage.getItem(MODEL_STORAGE_KEY)).toBe(
            'gemini-2.5-flash'
        );

        // Unmount — equivalent to ChatPanel closing.
        first.unmount();

        // Second mount with the same persisted state — equivalent to reopening.
        const second = await act(async () => {
            return renderHook(() => useChat({ symbol: 'AAPL' }), {
                wrapper: makeWrapper(),
            });
        });

        // User picks a different model in the new session — this MUST persist.
        // Pre-fix bug: the model write was silently skipped because the fresh
        // hook instance encountered an already-hydrated state and the stale
        // mount-flag heuristic discarded the write.
        await act(async () => {
            second.result.current.handleModelChange('gemini-2.5-flash-lite');
        });
        expect(localStorage.getItem(MODEL_STORAGE_KEY)).toBe(
            'gemini-2.5-flash-lite'
        );

        second.unmount();
    });
});
