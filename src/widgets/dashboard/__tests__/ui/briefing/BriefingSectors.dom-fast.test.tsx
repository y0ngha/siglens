import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { BriefingSectors } from '@/widgets/dashboard/ui/briefing/BriefingSectors';

const LEADING = [{ symbol: 'XLK', name: '기술' }];
const LAGGING = [{ symbol: 'XLE', name: '에너지' }];

describe('BriefingSectors', () => {
    it('강세·약세 줄과 서술 문장을 함께 그린다', () => {
        renderWithIntl(
            <BriefingSectors
                leadingSectors={LEADING}
                laggingSectors={LAGGING}
                performanceDescription="Tech led the way"
            />
        );
        expect(screen.getByText('상승 섹터')).toBeInTheDocument();
        expect(screen.getByText('하락 섹터')).toBeInTheDocument();
        expect(screen.getByText('Tech led the way')).toBeInTheDocument();
    });

    it('섹터명이 모두 걸러져도 서술 문장은 남긴다', () => {
        renderWithIntl(
            <BriefingSectors
                leadingSectors={[]}
                laggingSectors={[]}
                performanceDescription="Tech led the way"
            />
        );
        expect(screen.getByText('Tech led the way')).toBeInTheDocument();
        expect(screen.queryByText('상승 섹터')).not.toBeInTheDocument();
    });

    it('섹터명도 서술도 없으면 블록 전체를 그리지 않는다', () => {
        const { container } = renderWithIntl(
            <BriefingSectors
                leadingSectors={[]}
                laggingSectors={[]}
                performanceDescription=""
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
