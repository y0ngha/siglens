import { render, screen } from '@testing-library/react';
import { HeaderShell } from '../../../ui/header/HeaderShell';

describe('HeaderShell', () => {
    it('banner 역할의 header에 자식을 담는다', () => {
        render(
            <HeaderShell hiddenOnMobile={false}>
                <span>내용</span>
            </HeaderShell>
        );

        expect(screen.getByRole('banner')).toHaveTextContent('내용');
        expect(screen.getByRole('banner')).toHaveAttribute(
            'data-scroll-chrome'
        );
    });

    it('hiddenOnMobile이 아니면 inert가 아니고 밀어내지 않는다', () => {
        render(<HeaderShell hiddenOnMobile={false}>x</HeaderShell>);

        const header = screen.getByRole('banner');
        expect(header).not.toHaveAttribute('inert');
        expect(header.className).not.toContain('max-lg:-translate-y-full');
    });

    it('hiddenOnMobile이면 inert이고 lg 미만에서 위로 밀어낸다', () => {
        render(<HeaderShell hiddenOnMobile>x</HeaderShell>);

        const header = document.querySelector('header')!;
        expect(header).toHaveAttribute('inert');
        expect(header.className).toContain('max-lg:-translate-y-full');
    });
});
