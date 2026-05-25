import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/features/auth-login/ui/LoginForm';
import type { LoginFormState } from '@/shared/lib/auth/formTypes';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/login',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let loginState: LoginFormState = { error: null };
const mockFormAction = vi.fn();

vi.mock('@/features/auth-login/hooks/useLoginForm', () => ({
    useLoginForm: () => [loginState, mockFormAction],
}));

describe('Auth Login Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loginState = { error: null };
    });

    it('renders email and password fields', () => {
        render(<LoginForm />);
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(screen.getByLabelText('비밀번호')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '로그인' })
        ).toBeInTheDocument();
    });

    it('allows user to enter credentials', async () => {
        render(<LoginForm />);
        const user = userEvent.setup();
        const email = screen.getByLabelText('이메일');
        const password = screen.getByLabelText('비밀번호');
        await user.type(email, 'user@test.com');
        await user.type(password, 'secret123');
        expect(email).toHaveValue('user@test.com');
        expect(password).toHaveValue('secret123');
    });

    it('shows invalid_credentials error message', () => {
        loginState = {
            error: { code: 'invalid_credentials', message: '' },
        };
        render(<LoginForm />);
        expect(
            screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')
        ).toBeInTheDocument();
    });

    it('shows unexpected error message', () => {
        loginState = {
            error: {
                code: 'unexpected',
                message: '서버 오류가 발생했습니다.',
            },
        };
        render(<LoginForm />);
        expect(
            screen.getByText('서버 오류가 발생했습니다.')
        ).toBeInTheDocument();
    });

    it('shows initialError when no state error exists', () => {
        render(<LoginForm initialError="세션이 만료되었습니다." />);
        expect(screen.getByText('세션이 만료되었습니다.')).toBeInTheDocument();
    });

    it('renders hidden next field when next prop is provided', () => {
        const { container } = render(<LoginForm next="/dashboard" />);
        const hidden = container.querySelector('input[name="next"]');
        expect(hidden).toHaveValue('/dashboard');
    });
});
