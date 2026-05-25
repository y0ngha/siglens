import { renderHook } from '@testing-library/react';
import type { ModelId } from '@y0ngha/siglens-core';
import { useDefaultModelId } from '@/widgets/symbol-page/hooks/useDefaultModelId';

const MOCK_MODEL_ID = 'gemini-2.5-flash-lite' as ModelId;

vi.mock('@/widgets/symbol-page/SymbolModelContext', () => ({
    useSymbolModel: vi.fn(() => ({
        modelId: MOCK_MODEL_ID,
        allowedModels: [MOCK_MODEL_ID],
        isHydrated: true,
        gateModal: null,
        dismissGate: vi.fn(),
        handleModelChange: vi.fn(),
    })),
}));

describe('useDefaultModelId', () => {
    it('returns the modelId from SymbolModelContext', () => {
        const { result } = renderHook(() => useDefaultModelId());
        expect(result.current).toBe(MOCK_MODEL_ID);
    });
});
