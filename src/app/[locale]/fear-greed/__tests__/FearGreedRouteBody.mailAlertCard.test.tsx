vi.mock('@/widgets/market-fear-greed/MarketFearGreedPage', () => ({
    MarketFearGreedPage: () => <div data-testid="gauge-page" />,
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateIfFmpFailedAtBuild: vi.fn(async () => undefined),
    shortenRevalidateIfDatabaseMissingAtBuild: vi.fn(async () => undefined),
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

import { render, screen } from '@testing-library/react';
import { FearGreedRouteBody } from '@/app/[locale]/fear-greed/FearGreedRouteBody';
import type {
    MarketFearGreedHubView,
    MarketFearGreedViewSnapshot,
} from '@/entities/market-fear-greed/model';

const VIEW: MarketFearGreedHubView<MarketFearGreedViewSnapshot> = {
    snapshot: null,
    comparisons: [],
    history: [],
};

const CARD_LINE =
    '극단적 공포나 극단적 탐욕에 들어서면 점수가 확정된 뒤 한국 시간 아침에 메일로 알려 드려요';

describe('공포 탐욕 허브의 "메일로 받기" 카드', () => {
    it('공개 전에는 그리지 않는다', () => {
        launched.value = false;
        render(<FearGreedRouteBody market="us" view={VIEW} locale="ko" />);

        expect(screen.queryByText(CARD_LINE)).not.toBeInTheDocument();
    });

    it('공개 후에는 게이지 본문과 이력 사이(게이지 뒤)에 카드를 둔다', () => {
        launched.value = true;
        const { container } = render(
            <FearGreedRouteBody market="kr" view={VIEW} locale="ko" />
        );

        const gauge = screen.getByTestId('gauge-page');
        const card = screen.getByText(CARD_LINE);
        expect(
            gauge.compareDocumentPosition(card) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(container.querySelector('main')).toContainElement(card);
        expect(
            screen.getByRole('button', { name: '메일로 받기' })
        ).toBeInTheDocument();
    });
});
