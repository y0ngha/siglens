import { symbolOfAppPath } from '@/shared/config/reservedFirstSegments';

describe('symbolOfAppPath', () => {
    describe('종목 라우트면', () => {
        it('첫 세그먼트를 대문자 종목으로 돌려준다', () => {
            expect(symbolOfAppPath('/AAPL')).toBe('AAPL');
            expect(symbolOfAppPath('/aapl/news')).toBe('AAPL');
            expect(symbolOfAppPath('/005930?tf=1Day')).toBe('005930');
        });
    });

    describe('종목 라우트가 아니면', () => {
        it('예약 세그먼트·로케일·루트는 null이다', () => {
            expect(symbolOfAppPath('/')).toBeNull();
            expect(symbolOfAppPath('/market')).toBeNull();
            expect(symbolOfAppPath('/fear-greed/kr')).toBeNull();
            expect(symbolOfAppPath('/en')).toBeNull();
            expect(symbolOfAppPath('/symbols')).toBeNull();
            expect(symbolOfAppPath('/methodology')).toBeNull();
        });
    });
});
