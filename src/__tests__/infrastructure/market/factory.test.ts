import { createMarketDataProvider } from '@/infrastructure/market/factory';
import { AlpacaProvider } from '@/infrastructure/market/alpaca';
import { FmpProvider } from '@/infrastructure/market/fmp';

jest.mock('@/infrastructure/market/alpaca');
jest.mock('@/infrastructure/market/fmp');

describe('createMarketDataProvider', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('MARKET_DATA_PROVIDER 환경 변수가 설정되지 않은 경우', () => {
        it('기본값으로 FmpProvider를 반환한다', () => {
            delete process.env.MARKET_DATA_PROVIDER;

            const provider = createMarketDataProvider();

            expect(provider).toBeInstanceOf(FmpProvider);
        });
    });

    describe('MARKET_DATA_PROVIDER=fmp로 설정된 경우', () => {
        it('FmpProvider를 반환한다', () => {
            process.env.MARKET_DATA_PROVIDER = 'fmp';

            const provider = createMarketDataProvider();

            expect(provider).toBeInstanceOf(FmpProvider);
        });
    });

    describe('MARKET_DATA_PROVIDER=alpaca로 설정된 경우', () => {
        it('AlpacaProvider를 반환한다', () => {
            process.env.MARKET_DATA_PROVIDER = 'alpaca';

            const provider = createMarketDataProvider();

            expect(provider).toBeInstanceOf(AlpacaProvider);
        });
    });

    describe('MARKET_DATA_PROVIDER가 알 수 없는 값으로 설정된 경우', () => {
        it('기본값인 FmpProvider를 반환한다', () => {
            process.env.MARKET_DATA_PROVIDER = 'unknown-provider';

            const provider = createMarketDataProvider();

            expect(provider).toBeInstanceOf(FmpProvider);
        });
    });
});
