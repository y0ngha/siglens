// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { useSignupFlow } from '@/features/auth-signup/hooks/useSignupFlow';
import { useSignupForm } from '@/features/auth-signup/hooks/useSignupForm';
import {
    useRequestEmailVerification,
    useVerifyEmail,
} from '@/features/auth-email-verification/hooks/useEmailVerificationForms';
import type { SignupFormState } from '@/shared/lib/auth/formTypes';
import { koMessage } from '@/shared/test-utils/koMessage';
import { makeFormData } from '@/shared/test-utils/makeFormData';

vi.mock('@/features/auth-signup/hooks/useSignupForm');
vi.mock('@/features/auth-email-verification/hooks/useEmailVerificationForms');

const mockEmailFormAction = vi.fn();

function setStates(
    signupState: SignupFormState = { error: null },
    { submitted = true, verified = true } = {}
) {
    vi.mocked(useRequestEmailVerification).mockReturnValue([
        { submitted, error: null },
        mockEmailFormAction,
        false,
    ]);
    vi.mocked(useVerifyEmail).mockReturnValue([
        { verified, error: null },
        vi.fn(),
        false,
    ]);
    vi.mocked(useSignupForm).mockReturnValue([signupState, vi.fn(), false]);
}

function renderFlow(onRestart = vi.fn()) {
    return renderHook(() =>
        useSignupFlow({ onRestart, focusEmailOnMount: false })
    );
}

describe('useSignupFlow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('forwards the submitted form to the verification request action', () => {
        setStates();
        const { result } = renderFlow();
        const formData = makeFormData({ email: 'a@b.com' });

        act(() => result.current.emailStep.action(formData));

        expect(mockEmailFormAction).toHaveBeenCalledWith(formData);
    });

    it('keeps the submitted email, trimmed, for the later steps', () => {
        setStates();
        const { result } = renderFlow();

        act(() =>
            result.current.emailStep.action(
                makeFormData({ email: '  a@b.com ' })
            )
        );

        expect(result.current.email).toBe('a@b.com');
    });

    it('routes a password error only to the password slot', () => {
        setStates({
            error: { code: 'weak_password', field: 'password', message: 'm' },
        });
        const { result } = renderFlow();

        expect(result.current.detailsStep).toMatchObject({
            passwordError: koMessage('entities.auth.error.passwordWeak'),
            bannerError: undefined,
            consentError: undefined,
        });
    });

    it('keeps the email step callbacks stable across renders', () => {
        setStates();
        const { result, rerender } = renderFlow();
        const { action, onDraftEmailChange } = result.current.emailStep;

        rerender();

        expect(result.current.emailStep.action).toBe(action);
        expect(result.current.emailStep.onDraftEmailChange).toBe(
            onDraftEmailChange
        );
    });

    it.each([
        { submitted: true, verified: false },
        { submitted: false, verified: true },
    ])(
        'restarts when the action state is already past step 1 at mount (%o)',
        flags => {
            setStates({ error: null }, flags);
            const onRestart = vi.fn();

            renderFlow(onRestart);

            expect(onRestart).toHaveBeenCalledTimes(1);
        }
    );

    it('does not restart a fresh mount at step 1', () => {
        setStates({ error: null }, { submitted: false, verified: false });
        const onRestart = vi.fn();

        renderFlow(onRestart);

        expect(onRestart).not.toHaveBeenCalled();
    });
});
