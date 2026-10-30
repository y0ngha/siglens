import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { NavMenuTrigger } from '../../../ui/nav/NavMenuTrigger';

describe('NavMenuTrigger', () => {
    const base = { panelId: 'p1', onClick: vi.fn() };

    it('aria-expanded와 aria-controls로 패널 상태를 알린다', () => {
        render(
            <NavMenuTrigger ref={createRef()} isOpen active={false} {...base}>
                뉴스
            </NavMenuTrigger>
        );

        const button = screen.getByRole('button', { name: /뉴스/ });
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(button).toHaveAttribute('aria-controls', 'p1');
    });

    it('라벨이 줄바꿈되지 않는다', () => {
        render(
            <NavMenuTrigger
                ref={createRef()}
                isOpen={false}
                active={false}
                {...base}
            >
                뉴스
            </NavMenuTrigger>
        );

        expect(screen.getByRole('button').className).toContain(
            'whitespace-nowrap'
        );
    });

    it('active면 강조 밑줄을 켠다', () => {
        render(
            <NavMenuTrigger ref={createRef()} isOpen={false} active {...base}>
                뉴스
            </NavMenuTrigger>
        );

        expect(screen.getByRole('button').className).toContain(
            'border-primary-500'
        );
    });

    it('클릭을 전달한다', () => {
        const onClick = vi.fn();
        render(
            <NavMenuTrigger
                ref={createRef()}
                isOpen={false}
                active={false}
                panelId="p1"
                onClick={onClick}
            >
                뉴스
            </NavMenuTrigger>
        );

        fireEvent.click(screen.getByRole('button'));

        expect(onClick).toHaveBeenCalledTimes(1);
    });
});
