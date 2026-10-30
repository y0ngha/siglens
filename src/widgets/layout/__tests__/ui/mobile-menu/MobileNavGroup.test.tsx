import { render, screen, within } from '@testing-library/react';
import { MobileNavGroup } from '../../../ui/mobile-menu/MobileNavGroup';
import { NAV_TREE } from '../../../utils/headerNavTree';

const NEWS = NAV_TREE.find(v => v.id === 'news')!;

describe('MobileNavGroup', () => {
    it('버티컬 제목으로 이름 붙은 그룹이다', () => {
        render(
            <MobileNavGroup vertical={NEWS} pathname="/" onNavigate={vi.fn()} />
        );

        expect(screen.getByRole('group', { name: '뉴스' })).toBeInTheDocument();
    });

    it('개요·지역·하위 링크를 펼친 채 모두 그린다', () => {
        render(
            <MobileNavGroup vertical={NEWS} pathname="/" onNavigate={vi.fn()} />
        );

        const hrefs = within(screen.getByRole('group'))
            .getAllByRole('link')
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

    it('현재 경로와 정확히 일치하는 링크만 aria-current다', () => {
        render(
            <MobileNavGroup
                vertical={NEWS}
                pathname="/news/us"
                onNavigate={vi.fn()}
            />
        );

        const current = screen
            .getAllByRole('link')
            .filter(a => a.getAttribute('aria-current') === 'page')
            .map(a => a.getAttribute('href'));
        expect(current).toEqual(['/news/us']);
    });
});
