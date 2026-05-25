import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ForgotPasswordForm } from '@/features/auth-password-reset/ui/ForgotPasswordForm';
import { useForgotPasswordForm } from '@/features/auth-password-reset/hooks/useForgotPasswordForm';
import type { ForgotPasswordFormState } from '@/shared/lib/auth/formTypes';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/auth-password-reset/hooks/useForgotPasswordForm');

const mockFormAction = vi.fn();
const mockUseForgotPasswordForm = vi.mocked(useForgotPasswordForm);

function setFormState(state: ForgotPasswordFormState) {
    mockUseForgotPasswordForm.mockReturnValue([state, mockFormAction, false]);
}

describe('ForgotPasswordForm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setFormState({ submitted: false });
    });

    it('renders email field and submit button before submission', () => {
        render(<ForgotPasswordForm />);
        expect(screen.getByLabelText('이메일')).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '재설정 링크 보내기' })
        ).toBeInTheDocument();
    });

    it('allows typing in email field', async () => {
        const user = userEvent.setup();
        render(<ForgotPasswordForm />);
        await user.type(screen.getByLabelText('이메일'), 'test@example.com');
        expect(screen.getByLabelText('이메일')).toHaveValue('test@example.com');
    });

    it('shows success message after submission', () => {
        setFormState({ submitted: true });
        render(<ForgotPasswordForm />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('메일을 확인해 주세요')).toBeInTheDocument();
    });

    it('hides form fields after submission', () => {
        setFormState({ submitted: true });
        render(<ForgotPasswordForm />);
        expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();
        expect(
            screen.queryByRole('button', { name: '재설정 링크 보내기' })
        ).not.toBeInTheDocument();
    });
});
