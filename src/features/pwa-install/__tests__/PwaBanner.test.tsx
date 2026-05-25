import { PwaBanner } from '@/features/pwa-install';
import { usePwaInstall } from '@/features/pwa-install/hooks/usePwaInstall';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@/features/pwa-install/hooks/usePwaInstall');

const mockUsePwaInstall = vi.mocked(usePwaInstall);

describe('PwaBanner', () => {
    it('showBanner=true이면 같은 shell을 가시 상태로 렌더한다', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: vi.fn(),
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        const shell = screen.getByTestId('pwa-banner-shell');
        expect(shell.className).toContain('h-12');
        expect(shell.className).not.toContain('invisible');
        expect(shell).toHaveAttribute('aria-hidden', 'false');
        expect(
            screen.getByRole('button', { name: '설치하기' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '배너 닫기' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: '설치하기' })
        ).toHaveAttribute('tabindex', '0');
    });

    it('닫기 버튼 클릭 → handleDismiss 호출', () => {
        const handleDismiss = vi.fn();
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: vi.fn(),
            handleDismiss,
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        fireEvent.click(screen.getByRole('button', { name: '배너 닫기' }));
        expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('설치하기 버튼 클릭 → handleInstall 호출', () => {
        const handleInstall = vi.fn();
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall,
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        fireEvent.click(screen.getByRole('button', { name: '설치하기' }));
        expect(handleInstall).toHaveBeenCalledTimes(1);
    });

    it('isIos=true && showIosModal=true → IosInstallModal 렌더', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: true,
            isIos: true,
            handleInstall: vi.fn(),
            handleDismiss: vi.fn(),
            handleModalClose: vi.fn(),
        });
        render(<PwaBanner />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
