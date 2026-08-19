import {
    localizedIndexName,
    localizedSectorName,
    localizedStockName,
} from '../localizedAssetName';

const SECTOR = { symbol: 'XLK', sectorName: 'Technology', koreanName: '기술' };
const INDEX = {
    symbol: 'GSPC',
    fmpSymbol: '^GSPC',
    displayName: 'S&P 500',
    koreanName: '미국 대형주 500',
};
const STOCK = { symbol: 'AAPL', koreanName: '애플', sectorSymbol: 'XLK' };

describe('localizedAssetName', () => {
    it('기본 로케일은 한국어명을 쓴다', () => {
        expect(localizedSectorName(SECTOR, 'ko')).toBe('기술');
        expect(localizedIndexName(INDEX, 'ko')).toBe('미국 대형주 500');
        expect(localizedStockName(STOCK, 'ko')).toBe('애플');
    });

    /** core 타입이 영문명을 이미 들고 있다 — 번역이 아니라 선택의 문제다. */
    it.each(['en', 'ja', 'zh'] as const)('%s는 영문명을 쓴다', locale => {
        expect(localizedSectorName(SECTOR, locale)).toBe('Technology');
        expect(localizedIndexName(INDEX, locale)).toBe('S&P 500');
    });

    /** `SectorStock`에는 영문명이 없다 — 티커는 금융 UI에서 보편적으로 읽힌다. */
    it.each(['en', 'ja', 'zh'] as const)(
        '%s 개별 종목은 티커로 떨어진다',
        locale => {
            expect(localizedStockName(STOCK, locale)).toBe('AAPL');
        }
    );
});
