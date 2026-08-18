import { describe, it, expect } from 'vitest';
import { toKoreanTickerRows } from '../toKoreanTickerRows';
import type { KrxListedItem } from '../krxListedInfoClient';

function item(overrides: Partial<KrxListedItem> = {}): KrxListedItem {
    return {
        shortCode: '005930',
        koreanName: '삼성전자',
        market: 'KOSPI',
        isin: 'KR7005930003',
        corpName: '삼성전자주식회사',
        ...overrides,
    };
}

describe('toKoreanTickerRows', () => {
    it('KOSPI 종목은 .KS 접미사를 붙이고 exchangeFullName을 채운다', () => {
        const rows = toKoreanTickerRows([
            item({
                shortCode: '005930',
                koreanName: '삼성전자',
                market: 'KOSPI',
            }),
        ]);

        expect(rows).toEqual([
            {
                symbol: '005930.KS',
                koreanName: '삼성전자',
                name: '삼성전자',
                exchange: 'KOSPI',
                exchangeFullName: 'Korea Exchange (KOSPI)',
            },
        ]);
    });

    it('KOSDAQ 종목은 .KQ 접미사를 붙이고 exchangeFullName을 채운다', () => {
        const rows = toKoreanTickerRows([
            item({
                shortCode: '247540',
                koreanName: '에코프로비엠',
                market: 'KOSDAQ',
            }),
        ]);

        expect(rows).toEqual([
            {
                symbol: '247540.KQ',
                koreanName: '에코프로비엠',
                name: '에코프로비엠',
                exchange: 'KOSDAQ',
                exchangeFullName: 'KOSDAQ',
            },
        ]);
    });

    it('KONEX 종목은 결과에서 빠진다 — yahoo에 시세가 없어 죽은 링크가 된다', () => {
        const rows = toKoreanTickerRows([
            item({ shortCode: '999999', market: 'KONEX' }),
        ]);

        expect(rows).toEqual([]);
    });

    it('KOSPI/KOSDAQ가 섞여도 KONEX만 걸러진다', () => {
        const rows = toKoreanTickerRows([
            item({ shortCode: '005930', market: 'KOSPI' }),
            item({ shortCode: '247540', market: 'KOSDAQ' }),
            item({ shortCode: '999999', market: 'KONEX' }),
        ]);

        expect(rows.map(r => r.symbol)).toEqual(['005930.KS', '247540.KQ']);
    });

    it('중복 shortCode(같은 시장)는 Map이 마지막 값으로 덮어써 한 행만 남는다', () => {
        // toKoreanTickerRows는 symbol(= shortCode + suffix)을 키로 Map을 채운다 —
        // 같은 symbol이 두 번 들어오면 나중 항목이 앞의 항목을 덮어쓴다.
        const rows = toKoreanTickerRows([
            item({
                shortCode: '005930',
                koreanName: '삼성전자(구)',
                market: 'KOSPI',
            }),
            item({
                shortCode: '005930',
                koreanName: '삼성전자(신)',
                market: 'KOSPI',
            }),
        ]);

        expect(rows).toHaveLength(1);
        expect(rows[0]!.koreanName).toBe('삼성전자(신)');
    });
});
