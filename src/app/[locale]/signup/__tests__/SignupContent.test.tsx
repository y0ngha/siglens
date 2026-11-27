import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

const { signupFormSpy, socialSpy, searchParamsRef } = vi.hoisted(() => ({
    signupFormSpy: vi.fn(),
    socialSpy: vi.fn(),
    searchParamsRef: { value: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));
vi.mock('@/features/auth-signup/ui/SignupForm', () => ({
    SignupForm: (props: { next?: string; socialSlot?: ReactNode }) => {
        signupFormSpy(props);
        return <div data-testid="signup-form">{props.socialSlot}</div>;
    },
}));
vi.mock('@/features/auth-oauth/ui/SocialLoginButtons', () => ({
    SocialLoginButtons: (props: { next?: string; divider?: string }) => {
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

    it('소셜 로그인 버튼은 폼의 socialSlot으로 넘기고 위쪽 구분선은 끈다', () => {
        render(<SignupContent />);
        expect(screen.getByTestId('signup-form')).toContainElement(
            screen.getByTestId('social')
        );
        expect(socialSpy).toHaveBeenCalledWith(
            expect.objectContaining({ divider: 'none' })
        );
    });

    it('소셜 버튼 뒤에 약관 안내 문구와 "또는 이메일로 가입" 구분을 순서대로 둔다', () => {
        render(<SignupContent />);
        const slot = screen.getByTestId('signup-form');
        const note = screen.getByText(
            '소셜 로그인을 시작하면 약관 동의 단계로 이어집니다.'
        );
        const divider = screen.getByText('또는 이메일로 가입');

        expect(slot).toContainElement(note);
        expect(slot).toContainElement(divider);
        expect(
            screen.getByTestId('social').compareDocumentPosition(note) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
            note.compareDocumentPosition(divider) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
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

    it('collapses an explicit root next to undefined', () => {
        searchParamsRef.value = new URLSearchParams({ next: '/' });
        render(<SignupContent />);
        expect(signupFormSpy).toHaveBeenCalledWith(
            expect.objectContaining({ next: undefined })
        );
    });
});
