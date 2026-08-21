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
vi.mock('@/features/auth-oauth/ui/SocialLoginButtons', () => ({
    SocialLoginButtons: (props: { next?: string }) => {
        socialSpy(props);
        return <div data-testid="social" />;
    },
}));

import { LoginContent } from '../LoginContent';
import koMessages from '@/../messages/ko.json';

// 문구는 이제 `entities.auth.error` 카탈로그에서 온다 — 예전엔 이 파일의 모듈
// 상수라 `/en/login`이 영어 폼 위에 한국어 배너를 띄웠다. ko 카탈로그를 직접
// 읽어 렌더 결과와 대조한다(문자열을 테스트에 복제하면 둘이 따로 논다).
const authError = koMessages.entities.auth.error as Record<string, string>;

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
                initialError: authError.oauthEmailConflict,
            })
        );
    });

    it('shows the password-reset success banner when password_reset=1', () => {
        searchParamsRef.value = new URLSearchParams({ password_reset: '1' });
        render(<LoginContent />);
        expect(screen.getByRole('status')).toHaveTextContent(
            authError.passwordResetSuccess
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
