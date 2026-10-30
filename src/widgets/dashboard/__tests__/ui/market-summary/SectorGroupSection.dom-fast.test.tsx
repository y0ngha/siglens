import { render, screen } from '@testing-library/react';
import type { MarketSectorData } from '@y0ngha/siglens-core';
import { SectorGroupSection } from '@/widgets/dashboard/ui/market-summary/SectorGroupSection';
import { sectorGridClass } from '@/widgets/dashboard/utils/marketGridClasses';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { TEST_SCOPE } from '../../helpers/testScope';

function sector(symbol: string): MarketSectorData {
    return {
        symbol,
        sectorName: symbol,
        koreanName: symbol,
        price: 50,
        changesPercentage: 0.5,
    };
}

describe('SectorGroupSection', () => {
    it('메시지 키가 있는 그룹 라벨은 로케일 문구로 보여 준다', () => {
        renderWithIntl(
            <SectorGroupSection
                label="성장"
                sectors={[sector('XLK')]}
                scope={TEST_SCOPE}
            />,
            { locale: 'en' }
        );
        expect(screen.getByText('Growth')).toBeInTheDocument();
        expect(screen.queryByText('성장')).not.toBeInTheDocument();
    });

    it('메시지 키가 없는 그룹 라벨은 원문을 그대로 보여 준다', () => {
        render(
            <SectorGroupSection
                label="Tech"
                sectors={[sector('XLK')]}
                scope={TEST_SCOPE}
            />
        );
        expect(screen.getByText('Tech')).toBeInTheDocument();
    });

    it.each([3, 4])('섹터 %i개짜리 그리드는 공유 클래스를 쓴다', count => {
        const sectors = Array.from({ length: count }, (_, i) =>
            sector(`S${i}`)
        );
        const { container } = render(
            <SectorGroupSection
                label="Tech"
                sectors={sectors}
                scope={TEST_SCOPE}
            />
        );
        expect(container.querySelector('.grid')).toHaveClass(
            ...sectorGridClass(count).split(' ')
        );
    });

    it('linkSectorCards인 시장은 섹터 카드를 종목 페이지로 링크한다', () => {
        render(
            <SectorGroupSection
                label="Tech"
                sectors={[sector('XLK')]}
                scope={TEST_SCOPE}
            />
        );
        expect(screen.getByRole('link')).toHaveAttribute('href', '/XLK');
    });

    it('linkSectorCards가 꺼진 시장은 링크를 붙이지 않는다', () => {
        render(
            <SectorGroupSection
                label="Tech"
                sectors={[sector('XLK')]}
                scope={{ ...TEST_SCOPE, linkSectorCards: false }}
            />
        );
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});
