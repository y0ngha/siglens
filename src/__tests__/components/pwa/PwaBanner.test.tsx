/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { PwaBanner } from '@/components/pwa/PwaBanner';
import { usePwaInstall } from '@/components/pwa/hooks/usePwaInstall';

jest.mock('@/components/pwa/hooks/usePwaInstall');

const mockUsePwaInstall = jest.mocked(usePwaInstall);

describe('PwaBanner', () => {
    it('showBanner=false여도 높이를 점유하는 shell을 렌더한다 (CLS 방지)', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: false,
            showIosModal: false,
            isIos: false,
            handleInstall: jest.fn(),
            handleDismiss: jest.fn(),
            handleModalClose: jest.fn(),
        });
        render(<PwaBanner />);
        const shell = screen.getByTestId('pwa-banner-shell');
        // Always rendered with a fixed height so the layout below does not
        // shift when the banner becomes visible later.
        expect(shell.className).toContain('h-12');
        expect(shell).toHaveAttribute('aria-hidden', 'true');
        expect(shell.className).toContain('invisible');
        // Buttons are removed from the tab order while hidden.
        // aria-hidden parent hides them from the accessibility tree, so
        // query with `hidden: true`.
        expect(
            screen.getByRole('button', { name: '설치하기', hidden: true })
        ).toHaveAttribute('tabindex', '-1');
    });

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
