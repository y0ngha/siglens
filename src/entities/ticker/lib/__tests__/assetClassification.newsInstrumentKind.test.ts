import { describe, expect, it } from 'vitest';
import { newsInstrumentKindFor } from '../assetClassification';

describe('newsInstrumentKindFor', () => {
    it.each([
        ['SPY', 'SPDR S&P 500 ETF Trust'],
        ['XLE', 'Energy Select Sector SPDR Fund'],
        ['069500.KS', 'KODEX 200'],
        ['^SPX', 'S&P 500'],
        // allowlist 밖이어도 이름이 펀드형이면 펀드
        ['ZZZQ', 'Example Thematic ETF'],
    ])('%s(%s)는 fund', (symbol, name) => {
        expect(newsInstrumentKindFor(symbol, name)).toBe('fund');
    });

    it.each([
        ['AAPL', 'Apple Inc.'],
        ['005930.KS', 'Samsung Electronics Co., Ltd.'],
        // 리츠는 Trust로 끝나도 상장사다(classifyAsset 주석)
        ['VNO', 'Vornado Realty Trust'],
    ])('%s(%s)는 company', (symbol, name) => {
        expect(newsInstrumentKindFor(symbol, name)).toBe('company');
    });
});
