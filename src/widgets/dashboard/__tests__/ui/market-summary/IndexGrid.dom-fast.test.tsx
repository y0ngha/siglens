import { render, screen } from '@testing-library/react';
import type { MarketIndexData } from '@y0ngha/siglens-core';
import { IndexGrid } from '@/widgets/dashboard/ui/market-summary/IndexGrid';
import { INDEX_GRID_CLASS } from '@/widgets/dashboard/utils/marketGridClasses';
import { TEST_SCOPE } from '../../helpers/testScope';

function index(symbol: string, fmpSymbol: string): MarketIndexData {
    return {
        symbol,
        fmpSymbol,
        displayName: symbol,
        koreanName: symbol,
        price: 100,
        changesPercentage: 1,
    };
}

describe('IndexGrid', () => {
    it('패널과 스켈레톤이 공유하는 그리드 클래스를 쓴다', () => {
        const { container } = render(
            <IndexGrid indices={[index('SPY', 'SPY')]} scope={TEST_SCOPE} />
        );
        expect(container.firstChild).toHaveClass(
            ...INDEX_GRID_CLASS.split(' ')
        );
    });

    it('지수마다 카드를 그린다', () => {
        const { container } = render(
            <IndexGrid
                indices={[index('SPY', 'SPY'), index('QQQ', 'QQQ')]}
                scope={TEST_SCOPE}
            />
        );
        expect(container.firstChild?.childNodes).toHaveLength(2);
    });

    it('`^` 지수는 통화 기호 없이, 그 밖의 심볼은 시장 통화 기호로 가격을 그린다', () => {
        render(
            <IndexGrid
                indices={[index('GSPC', '^GSPC'), index('SPY', 'SPY')]}
                scope={TEST_SCOPE}
            />
        );
        expect(screen.getByText('100')).toBeInTheDocument();
        expect(screen.getByText('$100')).toBeInTheDocument();
    });
});
