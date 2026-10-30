import { render, screen } from '@testing-library/react';
import { FooterNavColumn } from '../../../ui/footer/FooterNavColumn';

describe('FooterNavColumn', () => {
    const column = {
        id: 'news',
        label: '뉴스',
        links: [
            { href: '/news', label: '뉴스 전체' },
            { href: '/news/kr', label: '한국 뉴스' },
        ],
    };

    it('열 제목으로 이름 붙은 목록을 그린다', () => {
        render(<FooterNavColumn column={column} />);

        expect(screen.getByRole('list', { name: '뉴스' })).toBeInTheDocument();
    });

    it('제목은 헤딩이 아니다(문서 개요를 건드리지 않는다)', () => {
        render(<FooterNavColumn column={column} />);

        expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('링크 풀 라벨을 보이는 글자로 그린다', () => {
        render(<FooterNavColumn column={column} />);

        expect(
            screen
                .getAllByRole('link')
                .map(a => [a.textContent, a.getAttribute('href')])
        ).toEqual([
            ['뉴스 전체', '/news'],
            ['한국 뉴스', '/news/kr'],
        ]);
    });
});
