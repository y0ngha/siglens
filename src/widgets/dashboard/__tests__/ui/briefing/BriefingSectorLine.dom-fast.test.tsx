import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { BriefingSectorLine } from '@/widgets/dashboard/ui/briefing/BriefingSectorLine';

const SECTORS = [
    { symbol: 'XLK', name: '기술' },
    { symbol: 'XLF', name: '금융' },
];

describe('BriefingSectorLine', () => {
    it('섹터명을 쉼표로 이어 라벨과 함께 그린다', () => {
        renderWithIntl(
            <BriefingSectorLine
                label="상승 섹터"
                sectors={SECTORS}
                toneClass="text-ui-success-text"
            />
        );
        expect(screen.getByText('상승 섹터')).toBeInTheDocument();
        expect(screen.getByText('기술, 금융')).toHaveClass(
            'text-ui-success-text'
        );
    });

    it('로케일에 맞는 섹터명을 심볼로 찾아 보여 준다', () => {
        renderWithIntl(
            <BriefingSectorLine
                label="Rising Sectors"
                sectors={SECTORS}
                toneClass="text-ui-success-text"
            />,
            { locale: 'en' }
        );
        expect(screen.getByText('Technology, Financials')).toBeInTheDocument();
    });

    it('섹터가 없으면 아무것도 그리지 않는다', () => {
        const { container } = renderWithIntl(
            <BriefingSectorLine
                label="상승 섹터"
                sectors={[]}
                toneClass="text-ui-success-text"
            />
        );
        expect(container).toBeEmptyDOMElement();
    });
});
