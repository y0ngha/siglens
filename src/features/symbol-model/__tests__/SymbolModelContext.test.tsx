import { render, screen, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import {
    SymbolModelProvider,
    useSymbolModel,
} from '@/features/symbol-model/model/SymbolModelContext';

vi.mock('@y0ngha/siglens-core', () => ({
    getAllowedModels: vi.fn(() => ['gemini-2.5-flash-lite'] as ModelId[]),
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
}));

vi.mock('@/features/symbol-model/hooks/useSelectedModel', () => ({
    useSelectedModel: vi.fn(() => ['gemini-2.5-flash-lite', vi.fn(), true]),
}));

vi.mock('@/features/premium-gate', () => ({
    useModelGate: vi.fn(({ onAllow }: { onAllow: (m: ModelId) => void }) => ({
        gateModal: null,
        dismissGate: vi.fn(),
        handleModelChange: onAllow,
    })),
}));

const { mockUseUserTier, mockUseReasoningToggle } = vi.hoisted(() => ({
    mockUseUserTier: vi.fn(() => ({ tier: 'free', isLoading: false })),
    mockUseReasoningToggle: vi.fn(() => [false, vi.fn()]),
}));

vi.mock('@/features/symbol-model/hooks/useUserTier', () => ({
    useUserTier: mockUseUserTier,
}));

vi.mock('@/features/reasoning-toggle', () => ({
    useReasoningToggle: mockUseReasoningToggle,
}));

const queryClients: QueryClient[] = [];

function makeWrapper() {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    queryClients.push(client);
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={client}>
                <SymbolModelProvider>{children}</SymbolModelProvider>
            </QueryClientProvider>
        );
    };
}

describe('SymbolModelContext', () => {
    beforeEach(() => {
        mockUseUserTier.mockReturnValue({ tier: 'free', isLoading: false });
        mockUseReasoningToggle.mockReturnValue([false, vi.fn(), true]);
    });

    afterEach(() => {
        queryClients.splice(0).forEach(c => c.clear());
    });

    it('provides modelId to consumers', () => {
        function Consumer() {
            const { modelId } = useSymbolModel();
            return <span data-testid="model">{modelId}</span>;
        }

        render(<Consumer />, { wrapper: makeWrapper() });
        expect(screen.getByTestId('model').textContent).toBe(
            'gemini-2.5-flash-lite'
        );
    });

    it('provides allowedModels', () => {
        const { result } = renderHook(() => useSymbolModel(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.allowedModels).toEqual(['gemini-2.5-flash-lite']);
    });

    it('throws when used outside provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => {
            renderHook(() => useSymbolModel());
        }).toThrow('useSymbolModel must be used inside SymbolModelProvider');

        spy.mockRestore();
    });

    it('provides isHydrated flag', () => {
        const { result } = renderHook(() => useSymbolModel(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.isHydrated).toBe(true);
    });

    it('provides the resolved tier and its hydration state', () => {
        const { result } = renderHook(() => useSymbolModel(), {
            wrapper: makeWrapper(),
        });

        expect(result.current.tier).toBe('free');
        expect(result.current.isTierHydrated).toBe(true);
    });

    describe('reasoning gating (member-reasoning-toggle spec Part A)', () => {
        it('forces reasoning=false and canUseReasoning=false for free tier even if stored preference is true', () => {
            mockUseUserTier.mockReturnValue({ tier: 'free', isLoading: false });
            mockUseReasoningToggle.mockReturnValue([true, vi.fn(), true]);

            const { result } = renderHook(() => useSymbolModel(), {
                wrapper: makeWrapper(),
            });

            expect(result.current.canUseReasoning).toBe(false);
            expect(result.current.reasoning).toBe(false);
        });

        it('honors the stored true preference for member tier', () => {
            mockUseUserTier.mockReturnValue({
                tier: 'member',
                isLoading: false,
            });
            mockUseReasoningToggle.mockReturnValue([true, vi.fn(), true]);

            const { result } = renderHook(() => useSymbolModel(), {
                wrapper: makeWrapper(),
            });

            expect(result.current.canUseReasoning).toBe(true);
            expect(result.current.reasoning).toBe(true);
        });

        it('honors the stored true preference for pro tier', () => {
            mockUseUserTier.mockReturnValue({ tier: 'pro', isLoading: false });
            mockUseReasoningToggle.mockReturnValue([true, vi.fn(), true]);

            const { result } = renderHook(() => useSymbolModel(), {
                wrapper: makeWrapper(),
            });

            expect(result.current.canUseReasoning).toBe(true);
            expect(result.current.reasoning).toBe(true);
        });

        it('defaults reasoning=false for member tier when stored preference is false', () => {
            mockUseUserTier.mockReturnValue({
                tier: 'member',
                isLoading: false,
            });
            mockUseReasoningToggle.mockReturnValue([false, vi.fn(), true]);

            const { result } = renderHook(() => useSymbolModel(), {
                wrapper: makeWrapper(),
            });

            expect(result.current.canUseReasoning).toBe(true);
            expect(result.current.reasoning).toBe(false);
        });

        it('exposes setReasoning delegating to the underlying toggle setter', () => {
            const setReasoning = vi.fn();
            mockUseUserTier.mockReturnValue({
                tier: 'member',
                isLoading: false,
            });
            mockUseReasoningToggle.mockReturnValue([false, setReasoning, true]);

            const { result } = renderHook(() => useSymbolModel(), {
                wrapper: makeWrapper(),
            });

            result.current.setReasoning(true);
            expect(setReasoning).toHaveBeenCalledWith(true);
        });
    });
});
