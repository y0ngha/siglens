import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '@/features/auth-password-reset/ui/ForgotPasswordForm';
import { requestPasswordResetAction } from '@/features/auth-password-reset/actions/requestPasswordResetAction';

vi.mock(
    '@/features/auth-password-reset/actions/requestPasswordResetAction',
    () => ({ requestPasswordResetAction: vi.fn() })
);

const mockRequestAction = vi.mocked(requestPasswordResetAction);

describe('ForgotPasswordForm with the real action state', () => {
    beforeEach(() => {
        mockRequestAction.mockReset();
    });

    it('keeps the typed email after the action reports a format error', async () => {
        mockRequestAction.mockResolvedValue({
            submitted: false,
            errorCode: 'invalid_email',
        });
        const user = userEvent.setup();
        render(<ForgotPasswordForm />);

        await user.type(screen.getByLabelText('이메일'), 'user@example');
        await user.click(
            screen.getByRole('button', { name: '재설정 링크 보내기' })
        );
        await screen.findByRole('alert');

        expect(screen.getByLabelText('이메일')).toHaveValue('user@example');
    });

    it('submits the typed email to the action', async () => {
        mockRequestAction.mockResolvedValue({ submitted: true });
        const user = userEvent.setup();
        render(<ForgotPasswordForm />);

        await user.type(screen.getByLabelText('이메일'), 'user@example.com');
        await user.click(
            screen.getByRole('button', { name: '재설정 링크 보내기' })
        );
        await screen.findByText('메일을 확인해 주세요');

        const formData = mockRequestAction.mock.calls.find(
            ([, data]) => data.get('email') === 'user@example.com'
        );
        expect(formData).not.toBeUndefined();
    });
});
