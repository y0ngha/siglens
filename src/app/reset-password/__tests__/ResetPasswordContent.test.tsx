import { render, screen } from '@testing-library/react';

const { resetFormSpy, searchParamsRef } = vi.hoisted(() => ({
    resetFormSpy: vi.fn(),
    searchParamsRef: { value: new URLSearchParams() },
}));

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParamsRef.value,
}));
vi.mock('@/features/auth-password-reset', () => ({
    ResetPasswordForm: (props: { email: string; token: string }) => {
        resetFormSpy(props);
        return <div data-testid="reset-form" />;
    },
}));

import { ResetPasswordContent } from '../ResetPasswordContent';

describe('ResetPasswordContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        searchParamsRef.value = new URLSearchParams();
    });

    it('renders the form with email and token when both present', () => {
        searchParamsRef.value = new URLSearchParams({
            email: 'user@example.com',
            token: 'tok123',
        });
        render(<ResetPasswordContent />);
        expect(resetFormSpy).toHaveBeenCalledWith({
            email: 'user@example.com',
            token: 'tok123',
        });
    });

    it('shows the missing-params alert when token is absent', () => {
        searchParamsRef.value = new URLSearchParams({
            email: 'user@example.com',
        });
        render(<ResetPasswordContent />);
        expect(resetFormSpy).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(
            '재설정 링크가 올바르지 않습니다. 비밀번호 찾기를 다시 시도해주세요.'
        );
    });

    it('shows the missing-params alert when both absent', () => {
        render(<ResetPasswordContent />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
    });
});
