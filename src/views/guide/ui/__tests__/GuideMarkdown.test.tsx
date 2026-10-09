import { render, screen, within } from '@testing-library/react';
import { GuideMarkdown } from '../GuideMarkdown';

describe('GuideMarkdown', () => {
    it('h2·h3에 id를 붙이고 h1은 만들지 않는다 — 페이지 h1은 제목 하나다', () => {
        render(
            <GuideMarkdown markdown={'## 첫째\n\n### 둘째\n\n문단이에요.'} />
        );

        expect(screen.getByRole('heading', { level: 2 })).toHaveAttribute(
            'id',
            '첫째'
        );
        expect(screen.getByRole('heading', { level: 3 })).toHaveAttribute(
            'id',
            '둘째'
        );
        expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    });

    it('/ 로 시작하는 링크는 내부 링크, 나머지는 새 탭 외부 링크다', () => {
        render(
            <GuideMarkdown
                markdown={
                    '[내부](/guide/indicators/rsi) [외부](https://example.com) [프로토콜 상대](//evil.example)'
                }
            />
        );

        expect(screen.getByRole('link', { name: '내부' })).toHaveAttribute(
            'href',
            '/guide/indicators/rsi'
        );
        const external = screen.getByRole('link', { name: '외부' });
        expect(external).toHaveAttribute('target', '_blank');
        expect(external).toHaveAttribute('rel', 'noopener noreferrer');
        expect(
            screen.getByRole('link', { name: '프로토콜 상대' })
        ).toHaveAttribute('target', '_blank');
    });

    it('표는 가로 스크롤 영역 안에 두고 키보드 포커스를 받게 한다', () => {
        render(
            <GuideMarkdown markdown={'| 가 | 나 |\n| --- | --- |\n| 1 | 2 |'} />
        );

        const table = screen.getByRole('table');
        const scroller = screen.getByRole('region', {
            name: '스크롤할 수 있는 표',
        });
        expect(scroller).toContainElement(table);
        expect(scroller).toHaveAttribute('tabindex', '0');
        expect(scroller.className).toContain('overflow-x-auto');
        expect(
            within(table).getByRole('columnheader', { name: '가' })
        ).toHaveAttribute('scope', 'col');
    });

    it('물결표 하나짜리 범위(5~30)는 취소선이 아니라 글자 그대로 둔다', () => {
        const { container } = render(
            <GuideMarkdown markdown="5~30분봉 0.5%, 1~4시간봉 1%이고 ~~취소~~는 지운다." />
        );
        expect(container.textContent).toContain('5~30분봉 0.5%, 1~4시간봉 1%');
        expect(container.querySelectorAll('del')).toHaveLength(1);
        expect(container.querySelector('del')?.textContent).toBe('취소');
    });

    it('목록과 굵은 글씨를 의미 있는 요소로 그린다', () => {
        render(
            <GuideMarkdown
                markdown={'- **70** 위는 과열\n- 30 아래는 과매도'}
            />
        );

        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText('70').tagName).toBe('STRONG');
    });
});
