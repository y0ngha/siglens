import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import type { ContactFormError } from '@/shared/lib/types';
import { useFocusInvalidFieldOnError } from '@/features/contact-form/hooks/useFocusInvalidFieldOnError';

interface HarnessProps {
    error: ContactFormError | null;
    /** false면 오류 표식이 붙은 칸 없이 그린다 — 폼 단위 오류(전송 실패) 상황. */
    withInvalidFields?: boolean;
}

/** 첫 칸은 정상, 둘째·셋째 칸은 오류 표식이 붙은 폼. */
function Harness({ error, withInvalidFields = true }: HarnessProps) {
    const formRef = useRef<HTMLFormElement>(null);
    useFocusInvalidFieldOnError(formRef, error);
    return (
        <form ref={formRef}>
            <input aria-label="ok" aria-invalid="false" />
            {withInvalidFields && (
                <>
                    <input aria-label="first-invalid" aria-invalid="true" />
                    <input aria-label="second-invalid" aria-invalid="true" />
                </>
            )}
            <button type="submit">send</button>
        </form>
    );
}

const fieldError: ContactFormError = {
    code: 'title_required',
    field: 'title',
};

describe('useFocusInvalidFieldOnError', () => {
    it('focuses the first invalid field when an error arrives', () => {
        const { rerender } = render(<Harness error={null} />);
        rerender(<Harness error={{ ...fieldError }} />);
        expect(document.activeElement).toBe(
            screen.getByLabelText('first-invalid')
        );
    });

    it('does not focus an invalid field on mount when there is no error', () => {
        render(<Harness error={null} />);
        expect(document.activeElement).not.toBe(
            screen.getByLabelText('first-invalid')
        );
        expect(document.activeElement).toBe(document.body);
    });

    it('does not focus an invalid field on a null to null re-render', () => {
        const { rerender } = render(<Harness error={null} />);
        rerender(<Harness error={null} />);
        expect(document.activeElement).toBe(document.body);
    });

    it('keeps focus where it was when a form-level error has no invalid field', () => {
        const { rerender } = render(
            <Harness error={null} withInvalidFields={false} />
        );
        const button = screen.getByRole('button', { name: 'send' });
        button.focus();
        rerender(
            <Harness
                error={{ code: 'submission_failed' }}
                withInvalidFields={false}
            />
        );
        expect(document.activeElement).toBe(button);
    });

    it('does not steal focus on a re-render with the same error object', () => {
        const error = { ...fieldError };
        const { rerender } = render(<Harness error={error} />);
        screen.getByRole('button', { name: 'send' }).focus();
        rerender(<Harness error={error} />);
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'send' })
        );
    });

    it('refocuses when a new error object arrives with the same code', () => {
        const { rerender } = render(<Harness error={{ ...fieldError }} />);
        screen.getByRole('button', { name: 'send' }).focus();
        rerender(<Harness error={{ ...fieldError }} />);
        expect(document.activeElement).toBe(
            screen.getByLabelText('first-invalid')
        );
    });
});
