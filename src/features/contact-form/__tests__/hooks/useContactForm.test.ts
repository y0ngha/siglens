// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { useContactForm } from '@/features/contact-form/hooks/useContactForm';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

vi.mock('@/entities/inquiry/actions', () => ({
    submitContactAction: vi.fn(),
}));

describe('useContactForm', () => {
    it('returns a tuple of [state, formAction, isPending]', () => {
        const { result } = renderHook(() => useContactForm());
        const [state, formAction, isPending] = result.current;

        expect(state).toEqual({
            submitted: false,
            error: null,
            values: { title: '', email: '', content: '' },
        });
        expect(typeof formAction).toBe('function');
        expect(isPending).toBe(false);
    });

    it('initial state has submitted: false, error: null, and empty values', () => {
        const { result } = renderHook(() => useContactForm());

        expect(result.current[0]).toStrictEqual({
            submitted: false,
            error: null,
            values: { title: '', email: '', content: '' },
        });
    });

    it('initial values contain empty title, email, and content', () => {
        const { result } = renderHook(() => useContactForm());
        const { values } = result.current[0];

        expect(values).toBeDefined();
        expect(values!.title).toBe('');
        expect(values!.email).toBe('');
        expect(values!.content).toBe('');
    });

    it('returns a stable formAction reference across re-renders', () => {
        const { result, rerender } = renderHook(() => useContactForm());
        const firstAction = result.current[1];

        rerender();

        expect(result.current[1]).toBe(firstAction);
    });
});
