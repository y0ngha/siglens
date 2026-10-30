import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { SectorFactItem } from '@/widgets/dashboard/ui/sector-facts/SectorFactItem';
import type { DisplayedSectorFact } from '@/widgets/dashboard/utils/displayedSectorFacts';

const FACT: DisplayedSectorFact = {
    sectorSymbol: 'XLK',
    bullishCount: 2,
    bearishCount: 1,
    topSymbols: ['AAPL'],
    topStocks: [{ symbol: 'AAPL', koreanName: '애플' }],
};

function renderItem(fact: DisplayedSectorFact, locale?: 'en') {
    return renderWithIntl(
        <dl>
            <SectorFactItem fact={fact} fallbackName="폴백" />
        </dl>,
        { locale }
    );
}

describe('SectorFactItem', () => {
    it('섹터명을 카탈로그 라벨로 보여 주고 티커를 그대로 노출하지 않는다', () => {
        renderItem(FACT);
        expect(screen.getByRole('term')).toHaveTextContent('기술');
        expect(screen.getByRole('term')).not.toHaveTextContent('XLK');
    });

    it('로케일에 맞는 섹터명을 쓴다', () => {
        renderItem(FACT, 'en');
        expect(screen.getByRole('term')).toHaveTextContent('Technology');
    });

    it('카탈로그에 없는 섹터는 폴백 이름을 쓴다', () => {
        renderItem({ ...FACT, sectorSymbol: 'ZZZ_SECTOR' });
        expect(screen.getByRole('term')).toHaveTextContent('폴백');
    });

    it('상승·하락 신호 종목 수를 한 문장으로 알린다', () => {
        renderItem(FACT);
        expect(screen.getByRole('definition')).toHaveTextContent(
            '상승 신호 2종목, 하락 신호 1종목'
        );
    });

    it('대표 종목 링크를 설명에 포함한다', () => {
        renderItem(FACT);
        expect(
            screen.getByRole('link', { name: '애플 (AAPL)' })
        ).toBeInTheDocument();
    });
});
