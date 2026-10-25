import { render, screen } from '@testing-library/react';
import { guideEntry } from '@/__tests__/fixtures/guideFixtures';
import { GuideCard } from '../GuideCard';

function renderCard(entry: Parameters<typeof GuideCard>[0]['entry']) {
    return render(
        <ul>
            <GuideCard entry={entry} />
        </ul>
    );
}

describe('GuideCard', () => {
    it('용어 항목은 다른 이름을 한 줄로 싣는다', () => {
        renderCard(
            guideEntry({
                slug: 'rsi',
                category: 'indicators',
                aliases: ['상대강도지수'],
            })
        );
        expect(screen.getByText('상대강도지수')).toBeInTheDocument();
    });

    it('howto는 검색 전용 별칭을 카드에 싣지 않는다', () => {
        renderCard(
            guideEntry({
                slug: 'rsi-how-to-read',
                category: 'howto',
                title: 'RSI 보는 법',
                aliases: ['RSI 70 30'],
            })
        );
        expect(screen.getByText('RSI 보는 법')).toBeInTheDocument();
        expect(screen.queryByText('RSI 70 30')).not.toBeInTheDocument();
    });
});
