import { describe, it, expect } from 'vitest';
import {
    CRYPTO_MARKET_INDICES,
    CRYPTO_SIGNAL_SECTORS,
    CRYPTO_SECTOR_STOCKS,
} from '../dashboard-tickers-crypto';
import { CRYPTO_CATEGORIES } from '../crypto-categories';

describe('CRYPTO_MARKET_INDICES', () => {
    it('uses BTC and ETH as the index proxies (no crypto benchmark index exists)', () => {
        expect(CRYPTO_MARKET_INDICES.map(t => t.symbol)).toEqual([
            'BTCUSD',
            'ETHUSD',
        ]);
    });

    it('fmpSymbol mirrors symbol (already FMP-canonical)', () => {
        for (const ticker of CRYPTO_MARKET_INDICES) {
            expect(ticker.fmpSymbol).toBe(ticker.symbol);
        }
    });

    it('resolves the Korean name from CRYPTO_CATEGORIES, not a hardcoded copy', () => {
        const btc = CRYPTO_MARKET_INDICES.find(t => t.symbol === 'BTCUSD');
        expect(btc?.koreanName).toBe('비트코인');
        const eth = CRYPTO_MARKET_INDICES.find(t => t.symbol === 'ETHUSD');
        expect(eth?.koreanName).toBe('이더리움');
    });
});

describe('CRYPTO_SIGNAL_SECTORS', () => {
    it('mirrors CRYPTO_CATEGORIES as virtual sector groups (no ETFs for crypto)', () => {
        expect(CRYPTO_SIGNAL_SECTORS).toHaveLength(CRYPTO_CATEGORIES.length);
        expect(CRYPTO_SIGNAL_SECTORS.map(s => s.symbol)).toEqual(
            CRYPTO_CATEGORIES.map(c => c.id)
        );
        expect(CRYPTO_SIGNAL_SECTORS.map(s => s.koreanName)).toEqual(
            CRYPTO_CATEGORIES.map(c => c.label)
        );
    });
});

describe('CRYPTO_SECTOR_STOCKS', () => {
    it('flattens every category item into a scan target with its owning sectorSymbol', () => {
        const totalItems = CRYPTO_CATEGORIES.reduce(
            (n, c) => n + c.items.length,
            0
        );
        expect(CRYPTO_SECTOR_STOCKS).toHaveLength(totalItems);

        const btc = CRYPTO_SECTOR_STOCKS.find(s => s.symbol === 'BTCUSD');
        expect(btc).toEqual({
            symbol: 'BTCUSD',
            koreanName: '비트코인',
            sectorSymbol: 'major',
        });

        const doge = CRYPTO_SECTOR_STOCKS.find(s => s.symbol === 'DOGEUSD');
        expect(doge?.sectorSymbol).toBe('altcoin');
    });
});
