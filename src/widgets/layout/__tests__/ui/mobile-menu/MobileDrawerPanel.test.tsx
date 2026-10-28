import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { MobileDrawerPanel } from '../../../ui/mobile-menu/MobileDrawerPanel';

function renderPanel(isOpen: boolean, onClose = vi.fn()) {
    render(
        <MobileDrawerPanel
            drawerRef={createRef()}
            isOpen={isOpen}
            onClose={onClose}
        >
            <span>내용</span>
        </MobileDrawerPanel>
    );
    return document.getElementById('mobile-nav-drawer')!;
}

describe('MobileDrawerPanel', () => {
    it('document.body로 포털한다', () => {
        expect(renderPanel(false).parentElement).toBe(document.body);
    });

    it('닫혀 있으면 inert다', () => {
        expect(renderPanel(false)).toHaveAttribute('inert');
    });

    it('열려 있으면 inert가 아니고 aria-modal이다', () => {
        const drawer = renderPanel(true);

        expect(drawer).not.toHaveAttribute('inert');
        expect(drawer).toHaveAttribute('aria-modal', 'true');
    });

    it('백드롭은 열려 있을 때만 있고 클릭하면 닫는다', () => {
        const onClose = vi.fn();
        renderPanel(true, onClose);

        fireEvent.click(screen.getByTestId('mobile-nav-backdrop'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('닫혀 있으면 백드롭이 없다', () => {
        renderPanel(false);

        expect(
            screen.queryByTestId('mobile-nav-backdrop')
        ).not.toBeInTheDocument();
    });

    it('닫기 버튼을 누르면 onClose', () => {
        const onClose = vi.fn();
        renderPanel(true, onClose);

        fireEvent.click(screen.getByRole('button', { name: '메뉴 패널 닫기' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('백드롭과 드로어에 lg:hidden이 걸려 있다', () => {
        const drawer = renderPanel(true);

        expect(drawer).toHaveClass('lg:hidden');
        expect(screen.getByTestId('mobile-nav-backdrop')).toHaveClass(
            'lg:hidden'
        );
    });
});
