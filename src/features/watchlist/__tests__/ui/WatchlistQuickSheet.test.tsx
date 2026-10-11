vi.mock('@/features/watchlist/ui/WatchlistPreviewPanel', () => ({
    WatchlistPreviewPanel: ({
        variant,
        quotesEnabled,
        onNavigate,
    }: {
        variant: string;
        quotesEnabled: boolean;
        onNavigate: () => void;
    }) => (
        <button type="button" onClick={onNavigate}>
            {`${variant}:${String(quotesEnabled)}`}
        </button>
    ),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { WatchlistQuickSheet } from '@/features/watchlist/ui/WatchlistQuickSheet';

describe('WatchlistQuickSheet', () => {
    it('열리면 이름 붙은 대화상자 안에 시트 변형 패널을 시세 켠 채로 그린다', () => {
        render(<WatchlistQuickSheet open onOpenChange={vi.fn()} />);
        expect(
            screen.getByRole('dialog', { name: '관심종목' })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: 'sheet:true' })
        ).toBeInTheDocument();
    });

    it('패널에서 이동하면 시트를 닫는다', () => {
        const onOpenChange = vi.fn();
        render(<WatchlistQuickSheet open onOpenChange={onOpenChange} />);
        // pointer 이벤트 없이 누른다 — vaul의 드래그 해제 처리가 jsdom에 없는 transform을 읽는다.
        fireEvent.click(screen.getByRole('button', { name: 'sheet:true' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('닫혀 있으면 아무것도 그리지 않는다', () => {
        render(<WatchlistQuickSheet open={false} onOpenChange={vi.fn()} />);
        expect(screen.queryByRole('dialog')).toBeNull();
    });
});
