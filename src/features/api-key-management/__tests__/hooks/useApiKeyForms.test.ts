// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { useApiKeyForms } from '@/features/api-key-management/hooks/useApiKeyForms';
import {
    saveApiKeyAction,
    deleteApiKeyAction,
} from '@/entities/api-key/actions';

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

const mockSaveAction = vi.mocked(saveApiKeyAction);
const mockDeleteAction = vi.mocked(deleteApiKeyAction);

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

    it('invalidates the registeredProviders query once saveApiKeyAction succeeds', async () => {
        mockSaveAction.mockResolvedValue({
            status: 'success',
            message: 'API 키가 저장되었습니다.',
        });
        const { result } = renderHook(() => useApiKeyForms());

        const formData = new FormData();
        formData.set('provider', 'anthropic');
        formData.set('apiKey', 'sk-ant-test');
        result.current.saveFormAction(formData);

        await waitFor(() =>
            expect(result.current.saveState.status).toBe('success')
        );
        expect(mockInvalidateQueries).toHaveBeenCalledWith(
            expect.objectContaining({ queryKey: expect.any(Array) })
        );
    });

    it('invalidates the registeredProviders query once deleteApiKeyAction succeeds', async () => {
        mockDeleteAction.mockResolvedValue({
            status: 'success',
            message: '삭제되었습니다.',
        });
        const { result } = renderHook(() => useApiKeyForms());

        const formData = new FormData();
        formData.set('provider', 'anthropic');
        result.current.deleteFormAction(formData);

        await waitFor(() =>
            expect(result.current.deleteState.status).toBe('success')
        );
        expect(mockInvalidateQueries).toHaveBeenCalledWith(
            expect.objectContaining({ queryKey: expect.any(Array) })
        );
    });

    it('does not invalidate queries when saveApiKeyAction returns an error', async () => {
        mockSaveAction.mockResolvedValue({
            status: 'error',
            message: '저장에 실패했습니다.',
            code: 'unknown',
        });
        const { result } = renderHook(() => useApiKeyForms());

        const formData = new FormData();
        formData.set('provider', 'anthropic');
        formData.set('apiKey', 'sk-ant-test');
        result.current.saveFormAction(formData);

        await waitFor(() =>
            expect(result.current.saveState.status).toBe('error')
        );
        expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
});
