import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/features/auth-login/ui/LoginForm';
import { loginAction } from '@/features/auth-login/actions/loginAction';

// 실제 `useActionState` 경로(React 19의 제출 후 폼 리셋 포함)를 그대로 태우고,
// 서버 액션만 실패 상태를 돌려주도록 대체한다.
vi.mock('@/features/auth-login/actions/loginAction', () => ({
    loginAction: vi.fn(),
}));

const mockLoginAction = vi.mocked(loginAction);

describe('LoginForm after a failed submit', () => {
    beforeEach(() => {
        mockLoginAction.mockReset();
        mockLoginAction.mockResolvedValue({
            error: { code: 'invalid_credentials', message: '' },
        });
    });

    it('keeps the typed email', async () => {
        const user = userEvent.setup();
        render(<LoginForm />);
        await user.type(screen.getByLabelText('이메일'), 'user@test.com');
        await user.type(screen.getByLabelText('비밀번호'), 'wrong-pass');
        await user.click(screen.getByRole('button', { name: '로그인' }));

        expect(await screen.findByRole('alert')).toHaveTextContent(
            '이메일 또는 비밀번호가 올바르지 않습니다.'
        );
        expect(screen.getByLabelText('이메일')).toHaveValue('user@test.com');
    });

    it('moves focus to the password input', async () => {
        const user = userEvent.setup();
        render(<LoginForm />);
        await user.type(screen.getByLabelText('이메일'), 'user@test.com');
        await user.type(screen.getByLabelText('비밀번호'), 'wrong-pass');
        await user.click(screen.getByRole('button', { name: '로그인' }));

        await screen.findByRole('alert');
        expect(screen.getByLabelText('비밀번호')).toHaveFocus();
    });
});
