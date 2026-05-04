/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { OAuthConsentForm } from '@/components/auth/OAuthConsentForm';

jest.mock('@/infrastructure/auth/finalizeOAuthSignupAction', () => ({
    finalizeOAuthSignupAction: jest.fn(),
}));
jest.mock('@/infrastructure/auth/cancelOAuthSignupAction', () => ({
    cancelOAuthSignupAction: jest.fn(),
}));

describe('OAuthConsentForm', () => {
    const baseProps = {
        token: 'token-abc',
        provider: 'google' as const,
        email: 'new@example.com',
        name: 'Hong Gildong',
        avatarUrl: undefined,
        cancelAction:
            jest.fn() as unknown as typeof import('@/infrastructure/auth/cancelOAuthSignupAction').cancelOAuthSignupAction,
    };

    it('renders profile email and name', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByText('new@example.com')).toBeInTheDocument();
        expect(screen.getByText('Hong Gildong')).toBeInTheDocument();
    });

    it('renders ConsentCheckboxGroup with master and individual checkboxes', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(screen.getByLabelText('모두 동의')).toBeInTheDocument();
        expect(
            screen.getByLabelText(/개인정보 수집·이용 동의/)
        ).toBeInTheDocument();
        expect(
            screen.getByLabelText(/서비스 이용약관 동의/)
        ).toBeInTheDocument();
    });

    it('includes hidden token input in finalize form', () => {
        const { container } = render(<OAuthConsentForm {...baseProps} />);
        const tokenInput = container.querySelector(
            'input[name="token"][value="token-abc"]'
        );
        expect(tokenInput).not.toBeNull();
    });

    it('renders 가입 완료 and 취소 buttons', () => {
        render(<OAuthConsentForm {...baseProps} />);
        expect(
            screen.getByRole('button', { name: /가입 완료/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /취소/ })
        ).toBeInTheDocument();
    });
});
