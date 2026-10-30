import { signalStockHref } from '@/widgets/dashboard/utils/signalStockLink';

describe('signalStockHref', () => {
    it('큐레이션 종목은 종목 페이지 경로다', () => {
        expect(signalStockHref('AAPL')).toBe('/AAPL');
    });

    it('큐레이션 밖(noindex 롱테일) 종목은 null이다', () => {
        expect(signalStockHref('ZZZNOTREAL')).toBeNull();
    });
});
