import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteAccountConfirm } from '@/features/account-delete/ui/DeleteAccountConfirm';
import { useDeleteAccountForm } from '@/features/account-delete/hooks/useDeleteAccountForm';
import type { DeleteAccountFormState } from '@/shared/lib/auth/formTypes';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/account-delete/hooks/useDeleteAccountForm');
vi.mock('next/link', () => ({
    default: ({
        children,
        ...props
    }: {
        children: React.ReactNode;
        href: string;
    }) => <a {...props}>{children}</a>,
}));

const mockFormAction = vi.fn();
const mockUseDeleteAccountForm = vi.mocked(useDeleteAccountForm);

function setFormState(state: DeleteAccountFormState) {
    mockUseDeleteAccountForm.mockReturnValue([state, mockFormAction, false]);
}

const USER_EMAIL = 'user@example.com';

describe('DeleteAccountConfirm', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setFormState({ error: null });
    });

    it('renders user email display', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(screen.getByText(USER_EMAIL)).toBeInTheDocument();
    });

    it('renders email confirmation input', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(
            screen.getByLabelText('계속하려면 본인 이메일을 정확히 입력하세요')
        ).toBeInTheDocument();
    });

    it('shows default hint when input is empty', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(
            screen.getByText('이메일이 일치해야 탈퇴 버튼이 활성화됩니다.')
        ).toBeInTheDocument();
    });

    it('shows mismatch hint when input does not match email', async () => {
        const user = userEvent.setup();
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        await user.type(
            screen.getByLabelText('계속하려면 본인 이메일을 정확히 입력하세요'),
            'wrong@test.com'
        );
        expect(
            screen.getByText('입력한 이메일이 본인 이메일과 일치하지 않습니다.')
        ).toBeInTheDocument();
    });

    it('shows match hint and enables submit when input matches email', async () => {
        const user = userEvent.setup();
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        await user.type(
            screen.getByLabelText('계속하려면 본인 이메일을 정확히 입력하세요'),
            USER_EMAIL
        );
        expect(
            screen.getByText(
                '입력한 이메일이 일치합니다. 탈퇴 버튼이 활성화되었습니다.'
            )
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '계정 영구 삭제' })
        ).toBeEnabled();
    });

    it('disables submit button when email does not match', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(
            screen.getByRole('button', { name: '계정 영구 삭제' })
        ).toBeDisabled();
    });

    it('renders cancel link to /account', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        const cancelLink = screen.getByRole('link', { name: '취소' });
        expect(cancelLink).toHaveAttribute('href', '/account');
    });

    it('shows error alert when state has error', () => {
        setFormState({
            error: {
                code: 'not_authenticated',
                message: '로그인이 필요합니다.',
            },
        });
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(screen.getByRole('alert')).toHaveTextContent(
            '로그인이 필요합니다.'
        );
    });

    it('renders warning list items', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(
            screen.getByText(/이메일·닉네임·프로필 사진이 즉시 영구 삭제/)
        ).toBeInTheDocument();
    });

    it('matches case-insensitively', async () => {
        const user = userEvent.setup();
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        await user.type(
            screen.getByLabelText('계속하려면 본인 이메일을 정확히 입력하세요'),
            USER_EMAIL.toUpperCase()
        );
        expect(
            screen.getByRole('button', { name: '계정 영구 삭제' })
        ).toBeEnabled();
    });
});
