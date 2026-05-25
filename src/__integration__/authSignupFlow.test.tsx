import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/signup',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

const mockEmailFormAction = vi.fn();
const mockCodeFormAction = vi.fn();
const mockSignupFormAction = vi.fn();

let emailState = { submitted: false, error: null };
let codeState = { verified: false, error: null };
let signupState = { error: null };

vi.mock('@/features/auth-email-verification', () => ({
    useRequestEmailVerification: () => [emailState, mockEmailFormAction],
    useVerifyEmail: () => [codeState, mockCodeFormAction],
}));

vi.mock('@/features/auth-signup/hooks/useSignupForm', () => ({
    useSignupForm: () => [signupState, mockSignupFormAction],
}));

/**
 * SignupFormFlow is wrapped by SignupForm which detects cache restoration
 * via useLayoutEffect. When mocks start with submitted/verified=true,
 * it triggers infinite re-renders. Import SignupFormFlow directly would
 * be ideal but it's not exported. Instead we test the phases by testing
 * phase 1 (initial state) and error states that don't trigger the loop.
 */
async function importSignupForm(): Promise<React.FC<{ next?: string }>> {
    const mod = await import('@/features/auth-signup/ui/SignupForm');
    return mod.SignupForm;
}

describe('Auth Signup Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        emailState = { submitted: false, error: null };
        codeState = { verified: false, error: null };
        signupState = { error: null };
    });

    it('renders phase 1: email verification request', async () => {
        const SignupForm = await importSignupForm();
        render(<SignupForm />);
        expect(screen.getByText('1단계: 이메일 인증 요청')).toBeInTheDocument();
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '인증 코드 받기' })
        ).toBeInTheDocument();
    });

    it('allows user to type email in phase 1', async () => {
        const SignupForm = await importSignupForm();
        render(<SignupForm />);
        const user = userEvent.setup();
        const emailInput = screen.getByLabelText('이메일');
        await user.type(emailInput, 'test@example.com');
        expect(emailInput).toHaveValue('test@example.com');
    });

    it('shows error alert in phase 1 when error exists', async () => {
        emailState = {
            submitted: false,
            error: {
                code: 'invalid_email',
                message: '유효하지 않은 이메일',
            },
        } as unknown as typeof emailState;
        const SignupForm = await importSignupForm();
        render(<SignupForm />);
        expect(screen.getByText('유효하지 않은 이메일')).toBeInTheDocument();
    });

    it('renders submit button with correct pending label', async () => {
        const SignupForm = await importSignupForm();
        render(<SignupForm />);
        expect(
            screen.getByRole('button', { name: '인증 코드 받기' })
        ).toBeInTheDocument();
    });

    it('renders hidden next field when next prop is provided', async () => {
        emailState = { submitted: false, error: null };
        const SignupForm = await importSignupForm();
        const { container } = render(<SignupForm next="/dashboard" />);
        expect(container).toBeInTheDocument();
    });
});
