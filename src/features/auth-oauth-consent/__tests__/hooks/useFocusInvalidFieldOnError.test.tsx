import { useRef } from 'react';
import { render, screen } from '@testing-library/react';
import type { FinalizeOAuthSignupState } from '@/shared/lib/auth/formTypes';
import { useFocusInvalidFieldOnError } from '@/features/auth-oauth-consent/hooks/useFocusInvalidFieldOnError';

type ConsentError = FinalizeOAuthSignupState['error'];

interface HarnessProps {
    error: ConsentError;
    /** false면 모든 필수 항목이 동의된 상태로 그린다 — 오류 표식이 붙은 칸이 없다. */
    withUnticked?: boolean;
}

/**
 * `ConsentCheckboxGroup`처럼 동의한 항목에는 `aria-invalid`가 없고, 동의하지 않은
 * 필수 항목에만 `aria-invalid="true"`가 붙은 폼.
 */
function Harness({ error, withUnticked = true }: HarnessProps) {
    const formRef = useRef<HTMLFormElement>(null);
    useFocusInvalidFieldOnError(formRef, error);
    return (
        <form ref={formRef}>
            <input type="checkbox" aria-label="ticked" defaultChecked />
            {withUnticked ? (
                <>
                    <input
                        type="checkbox"
                        aria-label="first-unticked"
                        aria-invalid="true"
                    />
                    <input
                        type="checkbox"
                        aria-label="second-unticked"
                        aria-invalid="true"
                    />
                </>
            ) : (
                <input
                    type="checkbox"
                    aria-label="also-ticked"
                    defaultChecked
                />
            )}
            <button type="submit">send</button>
        </form>
    );
}

function consentError(): NonNullable<ConsentError> {
    return { code: 'consent_required', message: '필수 약관에 동의해 주세요.' };
}

describe('useFocusInvalidFieldOnError', () => {
    it('focuses the first unticked consent checkbox when an error arrives', () => {
        const { rerender } = render(<Harness error={undefined} />);
        rerender(<Harness error={consentError()} />);
        expect(document.activeElement).toBe(
            screen.getByLabelText('first-unticked')
        );
    });

    it('does not focus an unticked checkbox on mount when there is no error', () => {
        render(<Harness error={undefined} />);
        expect(document.activeElement).not.toBe(
            screen.getByLabelText('first-unticked')
        );
        expect(document.activeElement).toBe(document.body);
    });

    it('does not focus an unticked checkbox on a no-error to no-error re-render', () => {
        const { rerender } = render(<Harness error={undefined} />);
        rerender(<Harness error={undefined} />);
        expect(document.activeElement).toBe(document.body);
    });

    it('keeps focus where it was when an error arrives but every checkbox is ticked', () => {
        const { rerender } = render(
            <Harness error={undefined} withUnticked={false} />
        );
        const button = screen.getByRole('button', { name: 'send' });
        button.focus();
        rerender(<Harness error={consentError()} withUnticked={false} />);
        expect(document.activeElement).toBe(button);
    });

    it('does not steal focus on a re-render with the same error object', () => {
        const error = consentError();
        const { rerender } = render(<Harness error={error} />);
        screen.getByRole('button', { name: 'send' }).focus();
        rerender(<Harness error={error} />);
        expect(document.activeElement).toBe(
            screen.getByRole('button', { name: 'send' })
        );
    });

    it('refocuses when a new error object arrives with the same code', () => {
        const { rerender } = render(<Harness error={consentError()} />);
        screen.getByRole('button', { name: 'send' }).focus();
        rerender(<Harness error={consentError()} />);
        expect(document.activeElement).toBe(
            screen.getByLabelText('first-unticked')
        );
    });
});
