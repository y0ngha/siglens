// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useRadarRequestForm } from '@/features/radar-request/hooks/useRadarRequestForm';

vi.mock('@/entities/inquiry/actions/submitRadarRequestAction', () => ({
    submitRadarRequestAction: vi.fn(),
}));

describe('useRadarRequestForm', () => {
    it('[state, formAction, isPending] 튜플과 빈 초기 상태를 돌려준다', () => {
        const { result } = renderHook(() => useRadarRequestForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toStrictEqual({
            submitted: false,
            error: null,
            values: { symbol: '', email: '' },
        });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });
});
