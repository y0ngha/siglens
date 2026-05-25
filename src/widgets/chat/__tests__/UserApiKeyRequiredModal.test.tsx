vi.mock('@/shared/hooks/useFocusTrap', () => ({
    useFocusTrap: vi.fn(),
}));
vi.mock('@/shared/hooks/useEscapeKey', () => ({
    useEscapeKey: vi.fn(),
}));

import { render, screen, fireEvent } from '@testing-library/react';

import { UserApiKeyRequiredModal } from '../UserApiKeyRequiredModal';

const BASE_PROPS = {
    open: true,
    onClose: vi.fn(),
    provider: 'anthropic' as const,
    loggedIn: true,
    onSwitchToFree: vi.fn(),
};

describe('UserApiKeyRequiredModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders nothing when open is false', () => {
        const { container } = render(
            <UserApiKeyRequiredModal {...BASE_PROPS} open={false} />
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders the provider name in the title', () => {
        render(
            <UserApiKeyRequiredModal {...BASE_PROPS} provider="anthropic" />
        );

        expect(
            screen.getByText(/Anthropic API 키 등록이 필요해요/)
        ).toBeInTheDocument();
    });

    it('shows "API 키 등록하기" link for logged-in users', () => {
        render(<UserApiKeyRequiredModal {...BASE_PROPS} loggedIn={true} />);

        const link = screen.getByRole('link', { name: /API 키 등록하기/ });
        expect(link).toHaveAttribute('href', '/account');
    });

    it('shows "회원가입하기" link for logged-out users', () => {
        render(<UserApiKeyRequiredModal {...BASE_PROPS} loggedIn={false} />);

        const link = screen.getByRole('link', { name: /회원가입하기/ });
        expect(link).toHaveAttribute('href', '/signup');
    });

    it('calls onSwitchToFree when "무료 모델로 계속하기" is clicked', () => {
        const handleSwitch = vi.fn();
        render(
            <UserApiKeyRequiredModal
                {...BASE_PROPS}
                onSwitchToFree={handleSwitch}
            />
        );

        fireEvent.click(
            screen.getByRole('button', { name: /무료 모델로 계속하기/ })
        );

        expect(handleSwitch).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when the close button is clicked', () => {
        const handleClose = vi.fn();
        render(
            <UserApiKeyRequiredModal {...BASE_PROPS} onClose={handleClose} />
        );

        fireEvent.click(screen.getByRole('button', { name: /닫기/ }));

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('renders the dialog with aria-modal', () => {
        render(<UserApiKeyRequiredModal {...BASE_PROPS} />);

        const dialog = screen.getByRole('dialog');
        expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('displays the google provider name correctly', () => {
        render(<UserApiKeyRequiredModal {...BASE_PROPS} provider="google" />);

        expect(
            screen.getByText(/Google API 키 등록이 필요해요/)
        ).toBeInTheDocument();
    });
});
