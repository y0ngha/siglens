// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useSiglensApiKeyForms } from '@/features/siglens-api-key-management/hooks/useSiglensApiKeyForms';

vi.mock('@/entities/siglens-api-key/actions/createSiglensApiKeyAction', () => ({
    createSiglensApiKeyAction: vi.fn(),
}));
vi.mock('@/entities/siglens-api-key/actions/revokeSiglensApiKeyAction', () => ({
    revokeSiglensApiKeyAction: vi.fn(),
}));

describe('useSiglensApiKeyForms', () => {
    it('두 액션 모두 idle 상태로 시작한다', () => {
        const { result } = renderHook(() => useSiglensApiKeyForms());
        expect(result.current.createState).toEqual({ status: 'idle' });
        expect(result.current.revokeState).toEqual({ status: 'idle' });
    });

    it('폼 액션을 함수로 노출한다', () => {
        const { result } = renderHook(() => useSiglensApiKeyForms());
        expect(typeof result.current.createFormAction).toBe('function');
        expect(typeof result.current.revokeFormAction).toBe('function');
    });
});
