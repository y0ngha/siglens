import { fireEvent, render, screen } from '@testing-library/react';
import { MarketDataErrorNotice } from '@/widgets/dashboard/MarketDataErrorNotice';

describe('MarketDataErrorNotice', () => {
    it('role="alert"로 실패 안내 문구를 렌더한다', () => {
        render(
            <MarketDataErrorNotice marketLabel="미국 증시" onClose={() => {}} />
        );

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
        render(
            <MarketDataErrorNotice marketLabel="미국 증시" onClose={onClose} />
        );

        fireEvent.click(screen.getByRole('button', { name: '안내 닫기' }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    /**
     * 문구를 `'미국 증시'`로 박아 두면 `/market/kr`이 한국 데이터가 빈 상황에서
     * 미국 얘기를 한다. 하필 부분 실패가 예상되는 쪽이 한국이다(KR 섹터 ETF는 얇다).
     */
    it('시장 이름을 그대로 문구에 넣는다', () => {
        render(
            <MarketDataErrorNotice marketLabel="한국 증시" onClose={() => {}} />
        );

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent(
            '한국 증시 데이터를 불러오는 중 일부를 가져오지 못했어요.'
        );
        expect(alert).not.toHaveTextContent('미국');
    });

    it('전달한 className을 컨테이너에 합성한다', () => {
        render(
            <MarketDataErrorNotice
                marketLabel="미국 증시"
                onClose={() => {}}
                className="mb-extra"
            />
        );

        expect(screen.getByRole('alert')).toHaveClass('mb-extra');
    });
});
