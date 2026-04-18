import type { IndexTicker, SectorEtf, SectorGroupDef } from '@/domain/types';

export type { IndexTicker, SectorEtf, SectorGroupDef };

export const MARKET_INDICES: IndexTicker[] = [
    {
        symbol: 'GSPC',
        fmpSymbol: '^GSPC',
        displayName: 'S&P 500',
        koreanName: '미국 대형주 500',
    },
    {
        symbol: 'DJI',
        fmpSymbol: '^DJI',
        displayName: 'Dow Jones',
        koreanName: '다우 산업지수',
    },
    {
        symbol: 'IXIC',
        fmpSymbol: '^IXIC',
        displayName: 'NASDAQ',
        koreanName: '나스닥 종합',
    },
    {
        symbol: 'VIX',
        fmpSymbol: '^VIX',
        displayName: 'VIX',
        koreanName: '공포지수',
    },
];

export const SECTOR_ETFS: SectorEtf[] = [
    { symbol: 'XLK', sectorName: 'Technology', koreanName: '기술' },
    { symbol: 'XLF', sectorName: 'Financials', koreanName: '금융' },
    { symbol: 'XLE', sectorName: 'Energy', koreanName: '에너지' },
    { symbol: 'XLV', sectorName: 'Healthcare', koreanName: '헬스케어' },
    { symbol: 'XLY', sectorName: 'Cons. Disc.', koreanName: '경기소비재' },
    { symbol: 'XLP', sectorName: 'Cons. Staples', koreanName: '필수소비재' },
    { symbol: 'XLI', sectorName: 'Industrials', koreanName: '산업재' },
    { symbol: 'XLB', sectorName: 'Materials', koreanName: '소재' },
    { symbol: 'XLU', sectorName: 'Utilities', koreanName: '유틸리티' },
    { symbol: 'XLRE', sectorName: 'Real Estate', koreanName: '부동산' },
    { symbol: 'XLC', sectorName: 'Comm. Svc.', koreanName: '통신서비스' },
];

// GICS 기반 섹터 분류: 성장 / 경기민감 / 방어
export const SECTOR_GROUPS: readonly SectorGroupDef[] = [
    { label: '성장', symbols: ['XLK', 'XLC', 'XLY', 'XLF'] },
    { label: '경기민감', symbols: ['XLE', 'XLI', 'XLB'] },
    { label: '방어', symbols: ['XLV', 'XLP', 'XLU', 'XLRE'] },
];

export const MARKET_SUMMARY_FMP_SYMBOLS: readonly string[] = [
    ...MARKET_INDICES.map(i => i.fmpSymbol),
    ...SECTOR_ETFS.map(e => e.symbol),
];
