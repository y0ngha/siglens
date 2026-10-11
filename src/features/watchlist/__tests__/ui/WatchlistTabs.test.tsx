import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WatchlistTabs } from '@/features/watchlist/ui/WatchlistTabs';

describe('WatchlistTabs', () => {
    it('선택된 탭만 Tab 정지점이고 패널을 가리킨다', () => {
        render(
            <WatchlistTabs
                value="recent"
                onChange={vi.fn()}
                watchlistCount={3}
                idBase="t"
            />
        );
        const watch = screen.getByRole('tab', { name: '관심 3' });
        const recent = screen.getByRole('tab', { name: '최근 본' });
        expect(watch).toHaveAttribute('tabindex', '-1');
        expect(recent).toHaveAttribute('tabindex', '0');
        expect(recent).toHaveAttribute('aria-controls', 't-panel');
    });

    it('개수를 모르면(null) 숫자를 그리지 않는다', () => {
        render(
            <WatchlistTabs
                value="watchlist"
                onChange={vi.fn()}
                watchlistCount={null}
                idBase="t"
            />
        );
        expect(screen.getByRole('tab', { name: '관심' })).toBeInTheDocument();
    });

    it('좌우 방향키로 다른 탭을 고른다', async () => {
        const onChange = vi.fn();
        const user = userEvent.setup();
        render(
            <WatchlistTabs
                value="watchlist"
                onChange={onChange}
                watchlistCount={0}
                idBase="t"
            />
        );
        screen.getByRole('tab', { name: '관심 0' }).focus();
        await user.keyboard('{ArrowLeft}');
        expect(onChange).toHaveBeenCalledWith('recent');
    });
});
