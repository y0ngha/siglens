/**
 * Tests for useChat assetClass derivation (Rec #7).
 *
 * useChat derives `assetClass` from `assetInfo` via `marketProfileOf` +
 * `getDescriptor`, defaulting to 'equity' when assetInfo is absent.
 * This file verifies that the derived value is correctly forwarded to
 * `chatAction` as the last argument so crypto and equity get distinct
 * chat behaviour.
 *
 * Strategy: renderHook → call sendMessage → inspect the chatAction mock's
 * call args at position 9 (assetClass).
 */

import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// --- Controllable mocks (must be above imports) ---

const mockChatAction = vi.fn().mockResolvedValue({
    ok: true,
    message: 'ok',
    remainingTokens: 5,
});
const mockUseAssetInfo = vi.fn();

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
    useAssetInfo: (...args: unknown[]) => mockUseAssetInfo(...args),
}));
vi.mock('@/entities/chat-message/actions', () => ({
    chatAction: (...args: unknown[]) => mockChatAction(...args),
    getRemainingTokensAction: vi.fn().mockResolvedValue(5),
}));
vi.mock('@/entities/session/actions/currentUserAction', () => ({
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
vi.mock('@/shared/hooks/useHydrated', () => ({
    useHydrated: vi.fn(() => true),
}));

import { useChat } from '@/widgets/chat/hooks/useChat';
import type { AssetInfo } from '@/shared/lib/types';

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0, staleTime: 0 },
            mutations: { retry: false },
        },
    });
    function Wrapper({ children }: { children: React.ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                {children}
            </QueryClientProvider>
        );
    }
    return Wrapper;
}

/**
 * The assetClass arg is at position index 8 in chatAction's call signature:
 * 0=symbol, 1=companyName, 2=timeframe, 3=analysis, 4=currentMessages,
 * 5=text, 6=selectedModel, 7=currentAnalysisContext, 8=assetClass.
 */
const ASSET_CLASS_ARG_INDEX = 8;

function cryptoAssetInfo(): AssetInfo {
    return {
        symbol: 'BTCUSD',
        name: 'Bitcoin',
        koreanName: '비트코인',
        fmpSymbol: null,
        marketProfile: 'crypto',
    } as never;
}

function equityAssetInfo(): AssetInfo {
    return {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        koreanName: '애플',
        fmpSymbol: 'AAPL',
        marketProfile: 'us-equity',
    } as never;
}

describe('useChat — assetClass derivation (Rec #7)', () => {
    beforeEach(() => {
        localStorage.clear();
        vi.clearAllMocks();
        mockChatAction.mockResolvedValue({
            ok: true,
            message: 'ok',
            remainingTokens: 5,
        });
    });

    it("crypto assetInfo → assetClass 'crypto' forwarded to chatAction", async () => {
        mockUseAssetInfo.mockReturnValue(cryptoAssetInfo());

        const { result } = renderHook(() => useChat({ symbol: 'BTCUSD' }), {
            wrapper: makeWrapper(),
        });

        await act(async () => {
            await result.current.sendMessage('BTC 시세?');
        });

        expect(mockChatAction).toHaveBeenCalled();
        const args = mockChatAction.mock.calls[0];
        expect(args[ASSET_CLASS_ARG_INDEX]).toBe('crypto');
    });

    it("equity assetInfo → assetClass 'equity' forwarded to chatAction", async () => {
        mockUseAssetInfo.mockReturnValue(equityAssetInfo());

        const { result } = renderHook(() => useChat({ symbol: 'AAPL' }), {
            wrapper: makeWrapper(),
        });

        await act(async () => {
            await result.current.sendMessage('AAPL 실적?');
        });

        expect(mockChatAction).toHaveBeenCalled();
        const args = mockChatAction.mock.calls[0];
        expect(args[ASSET_CLASS_ARG_INDEX]).toBe('equity');
    });

    it("absent assetInfo (null) → assetClass defaults to 'equity'", async () => {
        mockUseAssetInfo.mockReturnValue(null);

        const { result } = renderHook(() => useChat({ symbol: 'UNKNOWN' }), {
            wrapper: makeWrapper(),
        });

        await act(async () => {
            await result.current.sendMessage('query?');
        });

        expect(mockChatAction).toHaveBeenCalled();
        const args = mockChatAction.mock.calls[0];
        expect(args[ASSET_CLASS_ARG_INDEX]).toBe('equity');
    });
});
