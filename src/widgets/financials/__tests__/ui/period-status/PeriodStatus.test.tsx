import { render, screen } from '@testing-library/react';
import { withLocale } from '@/shared/test-utils/intlRenderWrapper';
import { PeriodStatus } from '@/widgets/financials/ui/period-status/PeriodStatus';

describe('PeriodStatus', () => {
    it('아무 상태도 아니어도 빈 status 영역을 미리 마운트해 둔다', () => {
        render(<PeriodStatus isLoading={false} quarterUnavailable={false} />);
        expect(screen.getByRole('status')).toBeEmptyDOMElement();
    });

    it('조회 중이면 로딩 안내를 status로 알린다', () => {
        render(<PeriodStatus isLoading quarterUnavailable={false} />);
        expect(screen.getByRole('status')).toHaveTextContent('불러오는 중…');
    });

    it('분기를 못 가져왔으면 안내 문장을 status로 알린다', () => {
        render(<PeriodStatus isLoading={false} quarterUnavailable />);
        expect(screen.getByRole('status')).toHaveTextContent(
            '분기 재무제표를 불러오지 못해 연간 기준으로 보여 드려요.'
        );
    });

    it('안내 문장은 로케일별로 번역된다', () => {
        render(
            withLocale(
                <PeriodStatus isLoading={false} quarterUnavailable />,
                'en'
            )
        );
        expect(screen.getByRole('status')).toHaveTextContent(
            "Quarterly financial statements couldn't be loaded, so annual figures are shown."
        );
    });
});
