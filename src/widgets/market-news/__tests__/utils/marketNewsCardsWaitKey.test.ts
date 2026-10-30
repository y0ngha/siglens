import { marketNewsCardsWaitKey } from '@/widgets/market-news/utils/marketNewsCardsWaitKey';

const BASE = ['marketNewsCards', 'general', 'ko'] as const;

describe('marketNewsCardsWaitKey', () => {
    it('첫 시도는 목록 폴러와 같은 키다', () => {
        expect(marketNewsCardsWaitKey(BASE, 0)).toEqual([...BASE]);
    });

    it('재시도부터는 시도 번호가 붙어 시도마다 다른 키가 된다', () => {
        expect(marketNewsCardsWaitKey(BASE, 2)).toEqual([...BASE, 'retry', 2]);
    });
});
