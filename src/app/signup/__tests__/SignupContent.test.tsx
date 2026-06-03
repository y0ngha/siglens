import { render } from '@testing-library/react';

const { signupFormSpy, socialSpy, searchParamsRef } = vi.hoisted(() => ({
    signupFormSpy: vi.fn(),
    socialSpy: vi.fn(),
    searchParamsRef: { value: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));
vi.mock('@/features/auth-signup', () => ({
    SignupForm: (props: { next?: string }) => {
        signupFormSpy(props);
        return <div data-testid="signup-form" />;
    },
}));
vi.mock('@/features/auth-oauth', () => ({
    SocialLoginButtons: (props: { next?: string }) => {
        socialSpy(props);
        return <div data-testid="social" />;
    },
}));

import { SignupContent } from '../SignupContent';

describe('SignupContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchParamsRef.value = new URLSearchParams();
    });

    it('passes a sanitized next path to the form and social buttons', () => {
        searchParamsRef.value = new URLSearchParams({ next: '/market' });
        render(<SignupContent />);
        expect(signupFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/market' })
        );
        expect(socialSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: '/market' })
        );
    });

    it('drops an open-redirect next to undefined', () => {
        searchParamsRef.value = new URLSearchParams({
            next: 'https://evil.com',
        });
        render(<SignupContent />);
        expect(signupFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });

    it('passes undefined next when absent', () => {
        render(<SignupContent />);
        expect(signupFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });
});
