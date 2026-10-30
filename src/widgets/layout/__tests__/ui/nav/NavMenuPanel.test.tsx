import { render, within } from '@testing-library/react';
import { NavMenuPanel } from '../../../ui/nav/NavMenuPanel';
import { NAV_TREE } from '../../../utils/headerNavTree';

const NEWS = NAV_TREE.find(v => v.id === 'news')!;

function renderPanel(isOpen: boolean, pathname: string | null = '/') {
    render(
        <NavMenuPanel
            id="panel-1"
            vertical={NEWS}
            pathname={pathname}
            isOpen={isOpen}
            onNavigate={vi.fn()}
        />
    );
    return document.getElementById('panel-1')!;
}

describe('NavMenuPanel', () => {
    it('닫혀 있으면 invisible, 열려 있으면 visible이다', () => {
        expect(renderPanel(false).className).toContain('invisible');
    });

    it('열려 있으면 invisible이 아니다', () => {
        expect(renderPanel(true).className).not.toContain('invisible');
    });

    it('메뉴 역할 없이 이름 붙은 평범한 목록이다', () => {
        const panel = renderPanel(true);

        expect(panel.tagName).toBe('UL');
        expect(panel).toHaveAttribute('aria-label', '뉴스 바로가기');
        expect(panel).not.toHaveAttribute('role');
    });

    it('개요·지역·하위 목적지 링크를 모두 DOM에 남긴다', () => {
        const panel = renderPanel(false);

        const hrefs = within(panel)
            .getAllByRole('link', { hidden: true })
            .map(a => a.getAttribute('href'));
        expect(hrefs).toEqual([
            '/news',
            '/news/us',
            '/news/general',
            '/news/stock',
            '/news/forex',
            '/news/articles',
            '/news/kr',
            '/news/crypto',
        ]);
    });

    it('개요 항목 칸이 아래 지역 목록과의 구분선을 갖는다', () => {
        const panel = renderPanel(true);

        const overviewItem = within(panel)
            .getAllByRole('link')[0]!
            .closest('li')!;
        expect(overviewItem).toHaveClass('border-b');
    });

    it('현재 경로와 정확히 일치하는 링크만 aria-current다', () => {
        const panel = renderPanel(true, '/news/kr');

        const current = within(panel)
            .getAllByRole('link')
            .filter(a => a.getAttribute('aria-current') === 'page')
            .map(a => a.getAttribute('href'));
        expect(current).toEqual(['/news/kr']);
    });
});
