/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { PwaBanner } from '@/components/pwa/PwaBanner';

jest.mock('@/components/pwa/hooks/usePwaInstall', () => ({
    usePwaInstall: jest.fn(),
}));

import { usePwaInstall } from '@/components/pwa/hooks/usePwaInstall';
const mockUsePwaInstall = usePwaInstall as jest.Mock;

describe('PwaBanner', () => {
    it('showBanner=false이면 아무것도 렌더하지 않는다', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: false,
            showIosModal: false,
            isIos: false,
            handleInstall: jest.fn(),
            handleDismiss: jest.fn(),
            handleModalClose: jest.fn(),
        });
        const { container } = render(<PwaBanner />);
        expect(container).toBeEmptyDOMElement();
    });

    it('showBanner=true이면 배너를 렌더한다', () => {
        mockUsePwaInstall.mockReturnValue({
            showBanner: true,
            showIosModal: false,
            isIos: false,
            handleInstall: jest.fn(),
            handleDismiss: jest.fn(),
            handleModalClose: jest.fn(),
        });
        render(<PwaBanner />);
        expect(screen.getByRole('button', { name: '설치하기' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '배너 닫기' })).toBeInTheDocument();
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
});
