// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { useModelGate } from '@/features/premium-gate/hooks/useModelGate';
import { QUERY_KEYS } from '@/shared/config/queryConfig';
import type { ModelId, LlmProvider } from '@y0ngha/siglens-core';

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
    isClaudeAdaptiveModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'adaptive',
    isClaudeBudgetModelSpec: (s: { thinkingApi?: string }) =>
        s.thinkingApi === 'budget',
    isReasoningToggleable: () => true,
    // 픽스처 규약: 'free-model'은 free 등급, 'member-model'은 member 등급,
    // 그 외('premium-model' 포함)는 byok 등급으로 본다.
    getModelAccess: (m: string) =>
        m === 'free-model' ? 'free' : m === 'member-model' ? 'member' : 'byok',
    supportsHardOff: () => true,
    resolveReasoningConfig: (
        modes: { off: unknown; on: unknown; default: string },
        r?: boolean
    ) => ((r ?? modes.default === 'on') ? modes.on : modes.off),
    isFreeModel: (model: string) => model === 'free-model',
    getProviderForModel: (_model: string): LlmProvider =>
        'anthropic' as LlmProvider,
}));

vi.mock('@/entities/auth/actions', () => ({
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

    it('opens auth gate for a member model when the user is not logged in', () => {
        // member 등급도 로그인은 필요하다 — byok과의 차이는 "누가 요금을 내는가"다.
        mockCurrentUser = null;
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('member-model' as ModelId);
        });

        expect(result.current.gateModal).toEqual({
            mode: 'auth',
            provider: 'anthropic',
        });
        expect(onAllow).not.toHaveBeenCalled();
    });

    it('lets a logged-in non-pro user through on a member model without a key', () => {
        // 이번 3분류 도입의 핵심 회귀 지점. 이진 분류 시절에는 free가 아니면
        // 전부 BYOK 게이트에 걸려, 서버가 대납하는 모델에서도 키를 요구했다.
        mockCurrentUser = { tier: 'member' };
        mockRegisteredProviders = [];
        const onAllow = vi.fn();
        const { result } = renderHook(() => useModelGate({ onAllow }));

        act(() => {
            result.current.handleModelChange('member-model' as ModelId);
        });

        expect(result.current.gateModal).toBeNull();
        expect(onAllow).toHaveBeenCalledWith('member-model');
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
