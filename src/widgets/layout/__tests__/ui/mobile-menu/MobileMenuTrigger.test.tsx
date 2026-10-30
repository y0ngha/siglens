import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { MobileMenuTrigger } from '../../../ui/mobile-menu/MobileMenuTrigger';

describe('MobileMenuTrigger', () => {
    it('닫혀 있으면 "메뉴 열기", aria-expanded=false', () => {
        render(
            <MobileMenuTrigger
                ref={createRef()}
                isOpen={false}
                onClick={vi.fn()}
            />
        );

        expect(
            screen.getByRole('button', { name: '메뉴 열기' })
        ).toHaveAttribute('aria-expanded', 'false');
    });

    it('열려 있으면 "메뉴 닫기", aria-expanded=true', () => {
        render(
            <MobileMenuTrigger ref={createRef()} isOpen onClick={vi.fn()} />
        );

        expect(
            screen.getByRole('button', { name: '메뉴 닫기' })
        ).toHaveAttribute('aria-expanded', 'true');
    });

    it('드로어 id를 aria-controls로 가리키고 클릭을 전달한다', () => {
        const onClick = vi.fn();
        render(
            <MobileMenuTrigger
                ref={createRef()}
                isOpen={false}
                onClick={onClick}
            />
        );
        const button = screen.getByRole('button');

        fireEvent.click(button);

        expect(button).toHaveAttribute('aria-controls', 'mobile-nav-drawer');
        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
