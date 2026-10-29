// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { startTransition } from 'react';
import { useApiKeyForms } from '@/features/api-key-management/hooks/useApiKeyForms';
import { saveApiKeyAction } from '@/entities/api-key/actions/saveApiKeyAction';
import { deleteApiKeyAction } from '@/entities/api-key/actions/deleteApiKeyAction';

const mockInvalidateQueries = vi.fn();

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}));

vi.mock('@/entities/api-key/actions/saveApiKeyAction', () => ({
    saveApiKeyAction: vi.fn(),
}));
vi.mock('@/entities/api-key/actions/deleteApiKeyAction', () => ({
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

    it('reports neither form as pending initially', () => {
        const { result } = renderHook(() => useApiKeyForms());

        expect(result.current.isSavePending).toBe(false);
        expect(result.current.isDeletePending).toBe(false);
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
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['llm', 'registered-providers'],
        });
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
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['llm', 'registered-providers'],
        });
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

    it('calls onSuccess once a save succeeds', async () => {
        mockSaveAction.mockResolvedValue({
            status: 'success',
            message: 'API 키가 저장되었습니다.',
        });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useApiKeyForms({ onSuccess }));

        act(() =>
            startTransition(() => result.current.saveFormAction(new FormData()))
        );

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(onSuccess).toHaveBeenCalledWith('save');
    });

    it('calls onSuccess with the delete kind once a delete succeeds', async () => {
        mockDeleteAction.mockResolvedValue({
            status: 'success',
            message: 'API 키가 삭제되었습니다.',
        });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useApiKeyForms({ onSuccess }));

        act(() =>
            startTransition(() =>
                result.current.deleteFormAction(new FormData())
            )
        );

        await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
        expect(onSuccess).toHaveBeenCalledWith('delete');
    });

    it('does not call onSuccess when a delete fails', async () => {
        mockDeleteAction.mockResolvedValue({
            status: 'error',
            message: '삭제에 실패했습니다.',
        });
        const onSuccess = vi.fn();
        const { result } = renderHook(() => useApiKeyForms({ onSuccess }));

        act(() =>
            startTransition(() =>
                result.current.deleteFormAction(new FormData())
            )
        );

        await waitFor(() =>
            expect(result.current.deleteState.status).toBe('error')
        );
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it('forwards the submitted form data to saveApiKeyAction', async () => {
        mockSaveAction.mockResolvedValue({
            status: 'success',
            message: 'API 키가 저장되었습니다.',
        });
        const { result } = renderHook(() => useApiKeyForms());
        const formData = new FormData();
        formData.set('provider', 'google');

        act(() =>
            startTransition(() => result.current.saveFormAction(formData))
        );

        await waitFor(() =>
            expect(mockSaveAction).toHaveBeenCalledWith(
                { status: 'idle', message: null },
                formData
            )
        );
    });

    it('invalidates as soon as the action resolves, before the state commits', async () => {
        let resolveSave: (state: {
            status: 'success';
            message: string;
        }) => void = () => {};
        mockSaveAction.mockReturnValue(
            new Promise(resolve => {
                resolveSave = resolve;
            })
        );
        const { result, unmount } = renderHook(() => useApiKeyForms());
        act(() =>
            startTransition(() => result.current.saveFormAction(new FormData()))
        );
        await waitFor(() => expect(mockSaveAction).toHaveBeenCalled());
        unmount();

        await act(async () => {
            resolveSave({ status: 'success', message: '저장됨' });
        });

        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: ['llm', 'registered-providers'],
        });
    });
});
