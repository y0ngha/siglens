import { render } from '@testing-library/react';
import { MarketFearGreedFootnote } from '@/widgets/market-fear-greed/ui/footer/MarketFearGreedFootnote';
import koMessages from '@/../messages/ko.json';

const PAGE = koMessages.widgets['market-fear-greed'].page;

describe('MarketFearGreedFootnote', () => {
    it.each([
        ['us', PAGE.cnnDifference],
        ['kr', PAGE.krDifference],
        ['crypto', PAGE.cryptoDifference],
    ] as const)('renders the %s methodology disclosure', (market, text) => {
        const { getByText } = render(
            <MarketFearGreedFootnote
                market={market}
                confidence="normal"
                sampleSize={300}
            />
        );
        expect(getByText(text)).toBeInTheDocument();
    });

    it('renders the limited-confidence sample note', () => {
        const { getByText } = render(
            <MarketFearGreedFootnote
                market="us"
                confidence="limited"
                sampleSize={45}
            />
        );
        expect(
            getByText(
                '비교할 기록이 45거래일뿐이라 점수가 덜 정확할 수 있어요.'
            )
        ).toBeInTheDocument();
    });
});
