vi.mock('@/widgets/analysis/AnalysisSettingsMenu', () => ({
    AnalysisSettingsMenu: () => <div data-testid="settings" />,
}));
vi.mock('@/widgets/share/ui/ShareButton', () => ({
    ShareButton: () => <div data-testid="share" />,
}));
vi.mock('@/features/watchlist/ui/WatchlistToggleButton', () => ({
    WatchlistToggleButton: () => <div data-testid="star" />,
}));
vi.mock('@/features/watchlist/ui/RecordRecentSymbol', () => ({
    RecordRecentSymbol: () => null,
}));
vi.mock('@/features/portfolio-holding/ui/PortfolioChipMounted', () => ({
    PortfolioChipMounted: () => <div data-testid="holding" />,
}));
const launched = vi.hoisted(() => ({ value: true }));
vi.mock(
    '@/entities/mail-alert/lib/mailAlertConstants',
    async importOriginal => ({
        ...(await importOriginal<
            typeof import('@/entities/mail-alert/lib/mailAlertConstants')
        >()),
        isMailAlertLaunched: () => launched.value,
    })
);
const mailButton = vi.hoisted(() => vi.fn());
vi.mock('@/features/mail-alert/ui/MailAlertButton', () => ({
    MailAlertButton: (props: unknown) => {
        mailButton(props);
        return <div data-testid="mail-alert" />;
    },
}));

import { render, screen } from '@testing-library/react';
import {
    SymbolHeaderControls,
    type MailAlertSlot,
} from '@/views/symbol/ui/header/SymbolHeaderControls';

const SETTINGS = {} as React.ComponentProps<
    typeof SymbolHeaderControls
>['settings'];

function renderControls(mailAlertSlot: MailAlertSlot) {
    return render(
        <SymbolHeaderControls
            ticker="AAPL"
            watchlistLabel="애플"
            settings={SETTINGS}
            mailAlertSlot={mailAlertSlot}
        />
    );
}

describe('SymbolHeaderControls의 메일로 받기', () => {
    beforeEach(() => {
        mailButton.mockClear();
        launched.value = true;
    });

    it('대상 종목이면 ☆ 바로 뒤에 종목 항목으로 둔다', () => {
        renderControls('button');

        const star = screen.getByTestId('star');
        const mail = screen.getByTestId('mail-alert');
        expect(
            star.compareDocumentPosition(mail) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(star.nextElementSibling).toBe(mail);
        expect(mailButton).toHaveBeenCalledWith({
            topic: { kind: 'symbol', symbol: 'AAPL' },
            name: '애플',
        });
    });

    it('크립토·지수처럼 대상이 아니면 버튼도 자리도 그리지 않는다', () => {
        const { container } = renderControls('none');

        expect(screen.queryByTestId('mail-alert')).not.toBeInTheDocument();
        expect(mailButton).not.toHaveBeenCalled();
        expect(container.querySelectorAll('span.size-11')).toHaveLength(0);
    });

    it('자산 정보를 아직 모르면(reserved) 같은 크기의 빈 자리만 잡는다', () => {
        const { container } = renderControls('reserved');

        expect(screen.queryByTestId('mail-alert')).not.toBeInTheDocument();
        const slot = container.querySelector('span.size-11');
        expect(slot).toHaveAttribute('aria-hidden', 'true');
    });

    it('공개 전에는 reserved여도 자리를 잡지 않는다(기존 헤더와 같은 줄)', () => {
        launched.value = false;
        const { container } = renderControls('reserved');

        expect(container.querySelectorAll('span.size-11')).toHaveLength(0);
    });
});
