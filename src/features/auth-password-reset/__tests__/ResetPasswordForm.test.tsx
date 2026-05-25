import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResetPasswordForm } from '@/features/auth-password-reset/ui/ResetPasswordForm';
import { useResetPasswordForm } from '@/features/auth-password-reset/hooks/useResetPasswordForm';
import type { ResetPasswordFormState } from '@/shared/lib/auth/formTypes';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/auth-password-reset/hooks/useResetPasswordForm');

const mockFormAction = vi.fn();
const mockUseResetPasswordForm = vi.mocked(useResetPasswordForm);

function setFormState(state: ResetPasswordFormState) {
    mockUseResetPasswordForm.mockReturnValue([state, mockFormAction, false]);
}

describe('ResetPasswordForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setFormState({ error: null });
    });

    it('renders new password and confirm password fields', () => {
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument();
        expect(screen.getByLabelText('새 비밀번호 확인')).toBeInTheDocument();
    });

    it('renders submit button', () => {
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        expect(
            screen.getByRole('button', { name: '비밀번호 변경' })
        ).toBeInTheDocument();
    });

    it('renders hidden email and token inputs', () => {
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        const emailHidden = document.querySelector(
            'input[type="hidden"][name="email"]'
        ) as HTMLInputElement;
        const tokenHidden = document.querySelector(
            'input[type="hidden"][name="token"]'
        ) as HTMLInputElement;
        expect(emailHidden.value).toBe('user@test.com');
        expect(tokenHidden.value).toBe('abc123');
    });

    it('shows invalid_token error', () => {
        setFormState({
            error: { code: 'invalid_token', message: '' },
        });
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '재설정 링크가 유효하지 않거나 이미 사용되었습니다'
        );
    });

    it('shows expired_token error', () => {
        setFormState({
            error: { code: 'expired_token', message: '' },
        });
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '재설정 링크가 만료되었습니다'
        );
    });

    it('shows password field error when field is password', () => {
        setFormState({
            error: {
                code: 'weak_password',
                field: 'password',
                message: '비밀번호가 너무 짧습니다.',
            },
        });
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '비밀번호가 너무 짧습니다.'
        );
    });

    it('allows typing in password fields', async () => {
        const user = userEvent.setup();
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        await user.type(screen.getByLabelText('새 비밀번호'), 'newpass123');
        await user.type(
            screen.getByLabelText('새 비밀번호 확인'),
            'newpass123'
        );
        expect(screen.getByLabelText('새 비밀번호')).toHaveValue('newpass123');
        expect(screen.getByLabelText('새 비밀번호 확인')).toHaveValue(
            'newpass123'
        );
    });

    it('does not show error when state has no error', () => {
        render(<ResetPasswordForm email="user@test.com" token="abc123" />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
});
