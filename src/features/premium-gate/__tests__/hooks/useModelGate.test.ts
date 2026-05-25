// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useModelGate } from '@/features/premium-gate/hooks/useModelGate';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { ModelId, LlmProvider } from '@y0ngha/siglens-core';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let mockCurrentUser: { tier: string } | null = null;
let mockRegisteredProviders: { provider: string }[] = [];

vi.mock('@tanstack/react-query', () => ({
    useQuery: ({ queryKey }: { queryKey: readonly string[] }) => {
        if (queryKey[0] === QUERY_KEYS.currentUser()[0]) {
            return { data: mockCurrentUser };
        }
        if (queryKey[0] === QUERY_KEYS.registeredProviders()[0]) {
            return { data: mockRegisteredProviders };
        }
        return { data: undefined };
    },
}));

vi.mock('@y0ngha/siglens-core', () => ({
    isFreeModel: (model: string) => model === 'free-model',
    getProviderForModel: (_model: string): LlmProvider =>
        'anthropic' as LlmProvider,
}));

vi.mock('@/entities/session/actions', () => ({
    currentUserAction: vi.fn(),
}));

vi.mock('@/entities/api-key/actions', () => ({
    getRegisteredProvidersAction: vi.fn(),
}));

describe('useModelGate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCurrentUser = null;
        mockRegisteredProviders = [];
    });

    it('returns null gateModal initially', () => {
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        expect(result.current.gateModal).toBeNull();
    });

    it('calls onAllow directly for a free model', () => {
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('free-model' as ModelId);
        });

        expect(onAllow).toHaveBeenCalledWith('free-model');
        expect(result.current.gateModal).toBeNull();
    });

    it('opens auth gate for premium model when user is not logged in', () => {
        mockCurrentUser = null;
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('premium-model' as ModelId);
        });

        expect(result.current.gateModal).toEqual({
            mode: 'auth',
            provider: 'anthropic',
        });
        expect(onAllow).not.toHaveBeenCalled();
    });

    it('calls onAllow directly for premium model when user has pro tier', () => {
        mockCurrentUser = { tier: 'pro' };
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('premium-model' as ModelId);
        });

        expect(onAllow).toHaveBeenCalledWith('premium-model');
        expect(result.current.gateModal).toBeNull();
    });

    it('opens byok gate for premium model when non-pro user has no registered provider', () => {
        mockCurrentUser = { tier: 'free' };
        mockRegisteredProviders = [];
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('premium-model' as ModelId);
        });

        expect(result.current.gateModal).toEqual({
            mode: 'byok',
            provider: 'anthropic',
        });
        expect(onAllow).not.toHaveBeenCalled();
    });

    it('calls onAllow for premium model when non-pro user has the required provider registered', () => {
        mockCurrentUser = { tier: 'free' };
        mockRegisteredProviders = [{ provider: 'anthropic' }];
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('premium-model' as ModelId);
        });

        expect(onAllow).toHaveBeenCalledWith('premium-model');
        expect(result.current.gateModal).toBeNull();
    });

    it('dismissGate sets gateModal to null', () => {
        mockCurrentUser = null;
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('premium-model' as ModelId);
        });

        expect(result.current.gateModal).not.toBeNull();

        act(() => {
            result.current.dismissGate();
        });

        expect(result.current.gateModal).toBeNull();
    });

    it('showGate sets the gate modal to the provided state', () => {
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.showGate({
                mode: 'byok',
                provider: 'anthropic' as LlmProvider,
            });
        });

        expect(result.current.gateModal).toEqual({
            mode: 'byok',
            provider: 'anthropic',
        });
    });
});
