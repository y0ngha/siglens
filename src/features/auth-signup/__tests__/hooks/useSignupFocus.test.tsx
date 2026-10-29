// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { useSignupFocus } from '@/features/auth-signup/hooks/useSignupFocus';
import type { SignupStepError } from '@/features/auth-signup/lib/signupFocusTarget';
import {
    SIGNUP_FIELD_ID,
    type SignupPhase,
} from '@/features/auth-signup/lib/signupPhase';

function weakPassword(): SignupStepError {
    return { code: 'weak_password', field: 'password', message: 'm' };
}

interface HarnessProps {
    phase: SignupPhase;
    focusFirstFieldOnMount?: boolean;
    error?: SignupStepError | null;
    fieldId?: string | null;
}

function Harness({
    phase,
    focusFirstFieldOnMount = false,
    error = null,
    fieldId = null,
}: HarnessProps) {
    useSignupFocus({ phase, focusFirstFieldOnMount, error, fieldId });
    return (
        <>
            <label htmlFor={SIGNUP_FIELD_ID.email}>email</label>
            <input id={SIGNUP_FIELD_ID.email} />
            <label htmlFor={SIGNUP_FIELD_ID.code}>code</label>
            <input id={SIGNUP_FIELD_ID.code} />
            <label htmlFor={SIGNUP_FIELD_ID.name}>name</label>
            <input id={SIGNUP_FIELD_ID.name} />
            <label htmlFor={SIGNUP_FIELD_ID.password}>password</label>
            <input id={SIGNUP_FIELD_ID.password} />
        </>
    );
}

describe('useSignupFocus', () => {
    it('leaves focus alone on the first render', () => {
        render(<Harness phase="email" />);
        expect(document.body).toHaveFocus();
    });

    it('focuses the first field on the first render when asked to', () => {
        render(<Harness phase="email" focusFirstFieldOnMount />);
        expect(screen.getByLabelText('email')).toHaveFocus();
    });

    it('focuses the new step’s first field when the phase changes', () => {
        const { rerender } = render(<Harness phase="code" />);
        rerender(<Harness phase="details" />);
        expect(screen.getByLabelText('name')).toHaveFocus();
    });

    it('does not refocus when the phase stays the same', () => {
        const { rerender } = render(<Harness phase="email" />);
        rerender(<Harness phase="code" />);
        screen.getByLabelText('password').focus();

        rerender(<Harness phase="code" />);

        expect(screen.getByLabelText('password')).toHaveFocus();
    });

    it('focuses the errored field when a new error arrives', () => {
        const { rerender } = render(<Harness phase="details" />);
        rerender(
            <Harness
                phase="details"
                error={weakPassword()}
                fieldId={SIGNUP_FIELD_ID.password}
            />
        );
        expect(screen.getByLabelText('password')).toHaveFocus();
    });

    it('does not move focus for an error already set on mount', () => {
        render(
            <Harness
                phase="details"
                error={weakPassword()}
                fieldId={SIGNUP_FIELD_ID.password}
            />
        );
        expect(document.body).toHaveFocus();
    });

    it('focuses the errored field when a new error replaces the mount-time one', () => {
        const { rerender } = render(
            <Harness
                phase="details"
                error={weakPassword()}
                fieldId={SIGNUP_FIELD_ID.password}
            />
        );
        rerender(
            <Harness
                phase="details"
                error={weakPassword()}
                fieldId={SIGNUP_FIELD_ID.password}
            />
        );
        expect(screen.getByLabelText('password')).toHaveFocus();
    });

    it('does not move focus for an error without a field', () => {
        const { rerender } = render(<Harness phase="details" />);
        rerender(
            <Harness
                phase="details"
                error={{ code: 'service_unavailable', message: 'm' }}
                fieldId={null}
            />
        );
        expect(document.body).toHaveFocus();
    });
});
