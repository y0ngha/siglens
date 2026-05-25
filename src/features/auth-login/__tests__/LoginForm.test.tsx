import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/features/auth-login/ui/LoginForm';
import { useLoginForm } from '@/features/auth-login/hooks/useLoginForm';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/auth-login/hooks/useLoginForm');

const mockFormAction = vi.fn();
const mockUseLoginForm = vi.mocked(useLoginForm);

function setLoginFormState(state: LoginFormState) {
    mockUseLoginForm.mockReturnValue([state, mockFormAction, false]);
}

describe('LoginForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setLoginFormState({ error: null });
    });

    it('renders email and password fields', () => {
        render(<LoginForm />);
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
    });

    it('renders submit button with login label', () => {
        render(<LoginForm />);
        expect(
            screen.getByRole('button', { name: '로그인' })
        ).toBeInTheDocument();
    });

    it('shows error alert for invalid_credentials', () => {
        setLoginFormState({
            error: { code: 'invalid_credentials', message: '' },
        });
        render(<LoginForm />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '이메일 또는 비밀번호가 올바르지 않습니다.'
        );
    });

    it('shows server error message when code is not invalid_credentials', () => {
        setLoginFormState({
            error: { code: 'unexpected', message: '서버 오류가 발생했습니다.' },
        });
        render(<LoginForm />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '서버 오류가 발생했습니다.'
        );
    });

    it('shows initialError when no state error exists', () => {
        render(<LoginForm initialError="세션이 만료되었습니다." />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '세션이 만료되었습니다.'
        );
    });

    it('does not show error when state and initialError are both absent', () => {
        render(<LoginForm />);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders hidden next input when next prop is provided', () => {
        render(<LoginForm next="/dashboard" />);
        const hidden = document.querySelector(
            'input[type="hidden"][name="next"]'
        ) as HTMLInputElement;
        expect(hidden).not.toBeNull();
        expect(hidden.value).toBe('/dashboard');
    });

    it('does not render hidden next input when next prop is absent', () => {
        render(<LoginForm />);
        expect(
            document.querySelector('input[type="hidden"][name="next"]')
        ).toBeNull();
    });

    it('allows typing in email field', async () => {
        const user = userEvent.setup();
        render(<LoginForm />);
        await user.type(screen.getByLabelText('이메일'), 'test@example.com');
        expect(screen.getByLabelText('이메일')).toHaveValue('test@example.com');
    });

    it('allows typing in password field', async () => {
        const user = userEvent.setup();
        render(<LoginForm />);
        await user.type(screen.getByLabelText('비밀번호'), 'secret123');
        expect(screen.getByLabelText('비밀번호')).toHaveValue('secret123');
    });
});
