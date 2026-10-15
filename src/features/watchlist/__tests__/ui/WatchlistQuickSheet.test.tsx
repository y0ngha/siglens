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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

    it('시트 콘텐츠에 모달 시트 표식을 단다 (열린 동안 PWA 배너·FAB 숨김 신호)', () => {
        render(<WatchlistQuickSheet open onOpenChange={vi.fn()} />);
        expect(
            screen.getByRole('dialog', { name: '관심종목' })
        ).toHaveAttribute('data-modal-sheet');
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

/**
 * 표식(`data-modal-sheet`)만으로는 아무것도 숨겨지지 않는다 — 실제 숨김은 globals.css 규칙이 한다.
 * jsdom은 빌드된 CSS를 적용하지 않으므로 소스를 읽어 규칙과 속성명이 함께 있는지 고정한다.
 * 규칙이 사라지면 모달 시트 위에 눌리지 않는 PWA 배너가 남아, X를 누른 탭이 시트 링크로 떨어진다.
 */
describe('globals.css — 모달 시트가 열리면 PWA 배너·FAB 숨김', () => {
    it('data-modal-sheet 시트가 있으면 배너와 FAB을 숨기는 규칙이 있다', () => {
        const css = readFileSync(
            join(process.cwd(), 'src/app/globals.css'),
            'utf-8'
        ).replace(/\s+/g, ' ');
        expect(css).toContain(
            'body:has([data-vaul-drawer][data-modal-sheet]) [data-ask-ai-fab], body:has([data-vaul-drawer][data-modal-sheet]) [data-pwa-banner] { display: none; }'
        );
    });
});
