import { fireEvent, render, screen } from '@testing-library/react';
import { MarketDataErrorNotice } from '@/widgets/dashboard/MarketDataErrorNotice';

describe('MarketDataErrorNotice', () => {
    it('role="alert"로 실패 안내 문구를 렌더한다', () => {
        render(<MarketDataErrorNotice onClose={() => {}} />);

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(
            '미국 증시 데이터를 불러오는 중 일부를 가져오지 못했어요.'
        );
        expect(alert).toHaveTextContent(
            '잠시 후 새로고침해 다시 시도해 주세요.'
        );
    });

    it('닫기 버튼 클릭 시 onClose를 호출한다', () => {
        const onClose = vi.fn();
        render(<MarketDataErrorNotice onClose={onClose} />);

        fireEvent.click(screen.getByRole('button', { name: '안내 닫기' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('전달한 className을 컨테이너에 합성한다', () => {
        render(
            <MarketDataErrorNotice onClose={() => {}} className="mb-extra" />
        );

        expect(screen.getByRole('alert')).toHaveClass('mb-extra');
    });
});
