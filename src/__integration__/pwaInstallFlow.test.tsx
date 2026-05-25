import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PwaBanner } from '@/features/pwa-install/ui/PwaBanner';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {}, sql: () => null })),
}));

let mockPwaState = {
    showBanner: false,
    showIosModal: false,
    isIos: false,
    handleInstall: vi.fn(),
    handleDismiss: vi.fn(),
    handleModalClose: vi.fn(),
};

vi.mock('@/features/pwa-install/hooks/usePwaInstall', () => ({
    usePwaInstall: () => mockPwaState,
}));

vi.mock('@/features/pwa-install/ui/IosInstallModal', () => ({
    IosInstallModal: ({ onClose }: { onClose: () => void }) => (
        <div data-testid="ios-modal">
            <button onClick={onClose}>Close</button>
        </div>
    ),
}));

describe('PWA Install Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPwaState = {
            showBanner: false,
            showIosModal: false,
            isIos: false,
            handleInstall: vi.fn(),
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        };
    });

    it('does not render banner when showBanner is false', () => {
        mockPwaState.showBanner = false;
        render(<PwaBanner />);
        expect(
            screen.queryByTestId('pwa-banner-shell')
        ).not.toBeInTheDocument();
    });

    it('renders banner when showBanner is true', () => {
        mockPwaState.showBanner = true;
        render(<PwaBanner />);
        expect(screen.getByTestId('pwa-banner-shell')).toBeInTheDocument();
        expect(screen.getByText('설치하기')).toBeInTheDocument();
    });

    it('calls handleInstall when install button is clicked', async () => {
        mockPwaState.showBanner = true;
        render(<PwaBanner />);
        const user = userEvent.setup();
        await user.click(screen.getByText('설치하기'));
        expect(mockPwaState.handleInstall).toHaveBeenCalledTimes(1);
    });

    it('calls handleDismiss when close button is clicked', async () => {
        mockPwaState.showBanner = true;
        render(<PwaBanner />);
        const user = userEvent.setup();
        await user.click(screen.getByLabelText('배너 닫기'));
        expect(mockPwaState.handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('shows iOS modal when isIos and showIosModal are true', () => {
        mockPwaState.showBanner = true;
        mockPwaState.isIos = true;
        mockPwaState.showIosModal = true;
        render(<PwaBanner />);
        expect(screen.getByTestId('ios-modal')).toBeInTheDocument();
    });

    it('does not show iOS modal on non-iOS', () => {
        mockPwaState.showBanner = true;
        mockPwaState.isIos = false;
        mockPwaState.showIosModal = true;
        render(<PwaBanner />);
        expect(screen.queryByTestId('ios-modal')).not.toBeInTheDocument();
    });
});
