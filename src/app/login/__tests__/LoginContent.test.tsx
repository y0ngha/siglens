import { render, screen } from '@testing-library/react';

const { loginFormSpy, socialSpy, searchParamsRef } = vi.hoisted(() => ({
    loginFormSpy: vi.fn(),
    socialSpy: vi.fn(),
    searchParamsRef: { value: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));
vi.mock('@/features/auth-login', () => ({
    LoginForm: (props: { next?: string; initialError?: string }) => {
        loginFormSpy(props);
        return <div data-testid="login-form" />;
    },
}));
vi.mock('@/features/auth-oauth', () => ({
    SocialLoginButtons: (props: { next?: string }) => {
        socialSpy(props);
        return <div data-testid="social" />;
    },
}));

import {
    LoginContent,
    OAUTH_ERROR_MESSAGES,
    PASSWORD_RESET_SUCCESS_MESSAGE,
} from '../LoginContent';

describe('LoginContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchParamsRef.value = new URLSearchParams();
    });

    it('passes a sanitized next path to the form and social buttons', () => {
        searchParamsRef.value = new URLSearchParams({ next: '/account' });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/account' })
        );
        expect(socialSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/account' })
        );
    });

    it('drops an open-redirect next to undefined', () => {
        searchParamsRef.value = new URLSearchParams({ next: '//evil.com' });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });

    it('collapses an explicit root next to undefined', () => {
        searchParamsRef.value = new URLSearchParams({ next: '/' });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });

    it('maps a known oauth error code to its message', () => {
        searchParamsRef.value = new URLSearchParams({
            error: 'oauth_email_conflict',
        });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({
                initialError: OAUTH_ERROR_MESSAGES.oauth_email_conflict,
            })
        );
    });

    it('shows the password-reset success banner when password_reset=1', () => {
        searchParamsRef.value = new URLSearchParams({ password_reset: '1' });
        render(<LoginContent />);
        expect(screen.getByRole('status')).toHaveTextContent(
            PASSWORD_RESET_SUCCESS_MESSAGE
        );
    });

    it('omits the banner without password_reset', () => {
        render(<LoginContent />);
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('passes undefined initialError for an unknown error code', () => {
        searchParamsRef.value = new URLSearchParams({
            error: 'some_unknown_code',
        });
        render(<LoginContent />);
        expect(loginFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ initialError: undefined })
        );
    });
});
