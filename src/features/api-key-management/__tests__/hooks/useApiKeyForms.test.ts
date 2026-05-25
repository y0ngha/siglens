// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useApiKeyForms } from '@/features/api-key-management/hooks/useApiKeyForms';

const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}));

vi.mock('@/entities/api-key/actions', () => ({
    saveApiKeyAction: vi.fn(),
    deleteApiKeyAction: vi.fn(),
}));

describe('useApiKeyForms', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns saveState and deleteState with idle initial status', () => {
        const { result } = renderHook(() => useApiKeyForms());

        expect(result.current.saveState).toEqual({
            status: 'idle',
            message: null,
        });
        expect(result.current.deleteState).toEqual({
            status: 'idle',
            message: null,
        });
    });

    it('returns saveFormAction and deleteFormAction as functions', () => {
        const { result } = renderHook(() => useApiKeyForms());

        expect(typeof result.current.saveFormAction).toBe('function');
        expect(typeof result.current.deleteFormAction).toBe('function');
    });

    it('does not invalidate queries when both states are idle', () => {
        renderHook(() => useApiKeyForms());

        expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
});
