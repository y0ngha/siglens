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
            screen.getByRole('menuitem', { name: '로그아웃' })
        ).toBeInTheDocument();
    });

    it('renders pending text when pending', () => {
        mockUseLogout.mockReturnValue({ pending: true, logout: vi.fn() });
        render(<LogoutButton />);
        expect(
            screen.getByRole('menuitem', { name: '로그아웃 중…' })
        ).toBeInTheDocument();
    });

    it('is disabled when pending', () => {
        mockUseLogout.mockReturnValue({ pending: true, logout: vi.fn() });
        render(<LogoutButton />);
        expect(screen.getByRole('menuitem')).toBeDisabled();
    });

    it('calls logout on click', async () => {
        const logoutFn = vi.fn();
        mockUseLogout.mockReturnValue({ pending: false, logout: logoutFn });
        const user = userEvent.setup();
        render(<LogoutButton />);
        await user.click(screen.getByRole('menuitem'));
        expect(logoutFn).toHaveBeenCalledTimes(1);
    });

    it('has button type="button"', () => {
        mockUseLogout.mockReturnValue({ pending: false, logout: vi.fn() });
        render(<LogoutButton />);
        expect(screen.getByRole('menuitem')).toHaveAttribute('type', 'button');
    });
});
