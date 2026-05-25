import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '@/features/auth-password-reset/ui/ForgotPasswordForm';
import { ResetPasswordForm } from '@/features/auth-password-reset/ui/ResetPasswordForm';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/forgot-password',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let forgotState = { submitted: false, error: null };
const mockForgotAction = vi.fn();

vi.mock('@/features/auth-password-reset/hooks/useForgotPasswordForm', () => ({
    useForgotPasswordForm: () => [forgotState, mockForgotAction],
}));

let resetState = { error: null };
const mockResetAction = vi.fn();

vi.mock('@/features/auth-password-reset/hooks/useResetPasswordForm', () => ({
    useResetPasswordForm: () => [resetState, mockResetAction],
}));

describe('Password Reset Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        forgotState = { submitted: false, error: null };
        resetState = { error: null };
    });

    describe('Forgot Password', () => {
        it('renders email input and submit button', () => {
            render(<ForgotPasswordForm />);
            expect(screen.getByLabelText('이메일')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '재설정 링크 보내기' })
            ).toBeInTheDocument();
        });

        it('allows email input', async () => {
            render(<ForgotPasswordForm />);
            const user = userEvent.setup();
            await user.type(
                screen.getByLabelText('이메일'),
                'user@example.com'
            );
            expect(screen.getByLabelText('이메일')).toHaveValue(
                'user@example.com'
            );
        });

        it('shows success notice after submission', () => {
            forgotState = { submitted: true, error: null };
            render(<ForgotPasswordForm />);
            expect(
                screen.getByText('메일을 확인해 주세요')
            ).toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: '재설정 링크 보내기' })
            ).not.toBeInTheDocument();
        });
    });

    describe('Reset Password', () => {
        it('renders new password fields and submit button', () => {
            render(
                <ResetPasswordForm
                    email="user@example.com"
                    token="test-token"
                />
            );
            expect(screen.getByLabelText('새 비밀번호')).toBeInTheDocument();
            expect(
                screen.getByLabelText('새 비밀번호 확인')
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '비밀번호 변경' })
            ).toBeInTheDocument();
        });

        it('shows mismatch error when passwords differ', async () => {
            render(
                <ResetPasswordForm
                    email="user@example.com"
                    token="test-token"
                />
            );
            const user = userEvent.setup();
            await user.type(
                screen.getByLabelText('새 비밀번호'),
                'NewPassword1!'
            );
            await user.type(
                screen.getByLabelText('새 비밀번호 확인'),
                'DifferentPass1!'
            );
            await user.click(
                screen.getByRole('button', { name: '비밀번호 변경' })
            );
            expect(
                screen.getByText('비밀번호가 일치하지 않습니다.')
            ).toBeInTheDocument();
        });

        it('shows invalid token error', () => {
            resetState = {
                error: { code: 'invalid_token', message: '' },
            } as unknown as typeof resetState;
            render(
                <ResetPasswordForm email="user@example.com" token="invalid" />
            );
            expect(
                screen.getByText(
                    '재설정 링크가 유효하지 않거나 이미 사용되었습니다. 다시 요청해 주세요.'
                )
            ).toBeInTheDocument();
        });
    });
});
