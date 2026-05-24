/**
 * @jest-environment jsdom
 */
import { PwaBanner } from '@/features/pwa-install';
import { usePwaInstall } from '@/features/pwa-install/hooks/usePwaInstall';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';

jest.mock('@/features/pwa-install/hooks/usePwaInstall');

const mockUsePwaInstall = jest.mocked(usePwaInstall);

describe('PwaBanner', () => {
    it('showBanner=true이면 같은 shell을 가시 상태로 렌더한다', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: jest.fn(),
            handleDismiss: jest.fn(),
            handleModalClose: jest.fn(),
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
        const handleDismiss = jest.fn();
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: jest.fn(),
            handleDismiss,
            handleModalClose: jest.fn(),
        });
        render(<PwaBanner />);
        fireEvent.click(screen.getByRole('button', { name: '배너 닫기' }));
        expect(handleDismiss).toHaveBeenCalledTimes(1);
    });

    it('설치하기 버튼 클릭 → handleInstall 호출', () => {
        const handleInstall = jest.fn();
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall,
            handleDismiss: jest.fn(),
            handleModalClose: jest.fn(),
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
            handleInstall: jest.fn(),
            handleDismiss: jest.fn(),
            handleModalClose: jest.fn(),
        });
        render(<PwaBanner />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
});
