import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoutButton } from '@/features/auth-logout/ui/LogoutButton';
import { useLogout } from '@/features/auth-logout/hooks/useLogout';

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));
vi.mock('@/features/auth-logout/hooks/useLogout');

const mockUseLogout = vi.mocked(useLogout);

describe('LogoutButton', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders logout text when not pending', () => {
        mockUseLogout.mockReturnValue({ pending: false, logout: vi.fn() });
        render(<LogoutButton />);
        expect(
            screen.getByRole('button', { name: '로그아웃' })
        ).toBeInTheDocument();
    });

    it('renders pending text when pending', () => {
        mockUseLogout.mockReturnValue({ pending: true, logout: vi.fn() });
        render(<LogoutButton />);
        expect(
            screen.getByRole('button', { name: '로그아웃 중…' })
        ).toBeInTheDocument();
    });

    it('is aria-disabled, not disabled, when pending', () => {
        mockUseLogout.mockReturnValue({ pending: true, logout: vi.fn() });
        render(<LogoutButton />);
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).not.toBeDisabled();
    });

    it('keeps focus and does not call logout again while pending', async () => {
        const logoutFn = vi.fn();
        mockUseLogout.mockReturnValue({ pending: true, logout: logoutFn });
        const user = userEvent.setup();
        render(<LogoutButton />);
        const button = screen.getByRole('button');
        button.focus();
        await user.click(button);
        await user.keyboard('{Enter}');
        expect(button).toHaveFocus();
        expect(logoutFn).not.toHaveBeenCalled();
    });

    it('calls logout on click', async () => {
        const logoutFn = vi.fn();
        mockUseLogout.mockReturnValue({ pending: false, logout: logoutFn });
        const user = userEvent.setup();
        render(<LogoutButton />);
        await user.click(screen.getByRole('button'));
        expect(logoutFn).toHaveBeenCalledTimes(1);
    });

    it('has button type="button"', () => {
        mockUseLogout.mockReturnValue({ pending: false, logout: vi.fn() });
        render(<LogoutButton />);
        expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });
});
