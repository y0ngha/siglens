import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DeleteAccountConfirm } from '@/features/account-delete/ui/DeleteAccountConfirm';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/account/delete',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/link', () => ({
    default: ({
        href,
        children,
        ...props
    }: {
        href: string;
        children: React.ReactNode;
        [key: string]: unknown;
    }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let deleteState = { error: null as unknown };
const mockDeleteAction = vi.fn();

vi.mock('@/features/account-delete/hooks/useDeleteAccountForm', () => ({
    useDeleteAccountForm: () => [deleteState, mockDeleteAction],
}));

describe('Account Delete Flow', () => {
    const USER_EMAIL = 'user@example.com';

    beforeEach(() => {
        vi.clearAllMocks();
        deleteState = { error: null };
    });

    it('renders confirmation form with user email displayed', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(screen.getByText(USER_EMAIL)).toBeInTheDocument();
        expect(
            screen.getByLabelText('계속하려면 본인 이메일을 정확히 입력하세요')
        ).toBeInTheDocument();
    });

    it('disables submit button when email does not match', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        const submitButton = screen.getByRole('button', {
            name: '계정 영구 삭제',
        });
        expect(submitButton).toBeDisabled();
    });

    it('enables submit button when email matches', async () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/본인 이메일/), USER_EMAIL);
        const submitButton = screen.getByRole('button', {
            name: '계정 영구 삭제',
        });
        expect(submitButton).toBeEnabled();
    });

    it('shows mismatch hint when email partially typed', async () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/본인 이메일/), 'wrong');
        expect(
            screen.getByText('입력한 이메일이 본인 이메일과 일치하지 않습니다.')
        ).toBeInTheDocument();
    });

    it('shows match hint when email matches', async () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        const user = userEvent.setup();
        await user.type(screen.getByLabelText(/본인 이메일/), USER_EMAIL);
        expect(
            screen.getByText(
                '입력한 이메일이 일치합니다. 탈퇴 버튼이 활성화되었습니다.'
            )
        ).toBeInTheDocument();
    });

    it('shows cancel link to account page', () => {
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        const cancelLink = screen.getByRole('link', { name: '취소' });
        expect(cancelLink).toHaveAttribute('href', '/account');
    });

    it('shows error alert when delete action fails', () => {
        deleteState = {
            error: {
                code: 'server_error',
                message: '탈퇴 처리에 실패했습니다.',
            },
        };
        render(<DeleteAccountConfirm userEmail={USER_EMAIL} />);
        expect(
            screen.getByText('탈퇴 처리에 실패했습니다.')
        ).toBeInTheDocument();
    });
});
