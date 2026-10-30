import { screen } from '@testing-library/react';
import { renderWithIntl } from '@/shared/test-utils/renderWithIntl';
import { TopStockLinks } from '@/widgets/dashboard/ui/sector-facts/TopStockLinks';

describe('TopStockLinks', () => {
    it('종목이 없으면 아무것도 그리지 않는다', () => {
        const { container } = renderWithIntl(<TopStockLinks stocks={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('종목마다 `이름 (티커)` 앵커로 종목 페이지에 링크한다', () => {
        renderWithIntl(
            <TopStockLinks
                stocks={[
                    { symbol: 'AAPL', koreanName: '애플' },
                    { symbol: 'ZZZQ', koreanName: '미등록' },
                ]}
            />
        );
        expect(
            screen.getByRole('link', { name: '애플 (AAPL)' })
        ).toHaveAttribute('href', '/AAPL');
        expect(
            screen.getByRole('link', { name: '미등록 (ZZZQ)' })
        ).toHaveAttribute('href', '/ZZZQ');
    });

    it('목록을 괄호로 감싸고 쉼표로 구분한다', () => {
        const { container } = renderWithIntl(
            <TopStockLinks
                stocks={[
                    { symbol: 'AAPL', koreanName: '애플' },
                    { symbol: 'ZZZQ', koreanName: '미등록' },
                ]}
            />
        );
        expect(container).toHaveTextContent('(애플 (AAPL), 미등록 (ZZZQ))');
    });

    it('로케일에 맞는 이름으로 앵커를 만든다', () => {
        renderWithIntl(
            <TopStockLinks stocks={[{ symbol: 'AAPL', koreanName: '애플' }]} />,
            { locale: 'en' }
        );
        expect(
            screen.getByRole('link', { name: 'Apple (AAPL)' })
        ).toBeInTheDocument();
    });
});
