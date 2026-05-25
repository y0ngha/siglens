import { render, screen, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ModelId } from '@y0ngha/siglens-core';
import {
    SymbolModelProvider,
    useSymbolModel,
} from '@/widgets/symbol-page/SymbolModelContext';

vi.mock('@y0ngha/siglens-core', () => ({
    getAllowedModels: vi.fn(() => ['gemini-2.5-flash-lite'] as ModelId[]),
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
}));

vi.mock('@/widgets/symbol-page/hooks/useSelectedModel', () => ({
    useSelectedModel: vi.fn(() => ['gemini-2.5-flash-lite', vi.fn(), true]),
}));

vi.mock('@/features/premium-gate', () => ({
    useModelGate: vi.fn(({ onAllow }: { onAllow: (m: ModelId) => void }) => ({
        gateModal: null,
        dismissGate: vi.fn(),
        handleModelChange: onAllow,
    })),
}));

vi.mock('@/widgets/symbol-page/hooks/useUserTier', () => ({
    useUserTier: vi.fn(() => ({ tier: 'free', isLoading: false })),
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
});
