import type {
    DashboardTimeframe,
    IndexTicker,
    SectorEtf,
    SectorGroupDef,
    SectorStock,
} from '@/domain/types';

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

export const SECTOR_STOCKS: readonly SectorStock[] = [
    // Technology (XLK) — 8
    { symbol: 'AAPL', koreanName: '애플', sectorSymbol: 'XLK' },
    { symbol: 'MSFT', koreanName: '마이크로소프트', sectorSymbol: 'XLK' },
    { symbol: 'NVDA', koreanName: '엔비디아', sectorSymbol: 'XLK' },
    { symbol: 'AVGO', koreanName: '브로드컴', sectorSymbol: 'XLK' },
    { symbol: 'AMD', koreanName: 'AMD', sectorSymbol: 'XLK' },
    { symbol: 'ORCL', koreanName: '오라클', sectorSymbol: 'XLK' },
    { symbol: 'QCOM', koreanName: '퀄컴', sectorSymbol: 'XLK' },
    { symbol: 'INTC', koreanName: '인텔', sectorSymbol: 'XLK' },
    // Financials (XLF) — 8
    { symbol: 'JPM', koreanName: 'JP모간', sectorSymbol: 'XLF' },
    { symbol: 'BAC', koreanName: '뱅크오브아메리카', sectorSymbol: 'XLF' },
    { symbol: 'GS', koreanName: '골드만삭스', sectorSymbol: 'XLF' },
    { symbol: 'MS', koreanName: '모간스탠리', sectorSymbol: 'XLF' },
    { symbol: 'WFC', koreanName: '웰스파고', sectorSymbol: 'XLF' },
    { symbol: 'BLK', koreanName: '블랙록', sectorSymbol: 'XLF' },
    { symbol: 'V', koreanName: '비자', sectorSymbol: 'XLF' },
    { symbol: 'MA', koreanName: '마스터카드', sectorSymbol: 'XLF' },
    // Energy (XLE) — 6
    { symbol: 'XOM', koreanName: '엑손모빌', sectorSymbol: 'XLE' },
    { symbol: 'CVX', koreanName: '쉐브론', sectorSymbol: 'XLE' },
    { symbol: 'COP', koreanName: '코노코필립스', sectorSymbol: 'XLE' },
    { symbol: 'SLB', koreanName: '슐럼버거', sectorSymbol: 'XLE' },
    { symbol: 'OXY', koreanName: '옥시덴탈', sectorSymbol: 'XLE' },
    { symbol: 'EOG', koreanName: 'EOG리소시스', sectorSymbol: 'XLE' },
    // Healthcare (XLV) — 7
    { symbol: 'UNH', koreanName: '유나이티드헬스', sectorSymbol: 'XLV' },
    { symbol: 'LLY', koreanName: '일라이릴리', sectorSymbol: 'XLV' },
    { symbol: 'JNJ', koreanName: '존슨앤드존슨', sectorSymbol: 'XLV' },
    { symbol: 'ABBV', koreanName: '애브비', sectorSymbol: 'XLV' },
    { symbol: 'MRK', koreanName: '머크', sectorSymbol: 'XLV' },
    { symbol: 'PFE', koreanName: '화이자', sectorSymbol: 'XLV' },
    { symbol: 'TMO', koreanName: '써모피셔', sectorSymbol: 'XLV' },
    // Consumer Discretionary (XLY) — 6
    { symbol: 'AMZN', koreanName: '아마존', sectorSymbol: 'XLY' },
    { symbol: 'TSLA', koreanName: '테슬라', sectorSymbol: 'XLY' },
    { symbol: 'HD', koreanName: '홈디포', sectorSymbol: 'XLY' },
    { symbol: 'MCD', koreanName: '맥도날드', sectorSymbol: 'XLY' },
    { symbol: 'NKE', koreanName: '나이키', sectorSymbol: 'XLY' },
    { symbol: 'LOW', koreanName: '로우스', sectorSymbol: 'XLY' },
    // Consumer Staples (XLP) — 6
    { symbol: 'WMT', koreanName: '월마트', sectorSymbol: 'XLP' },
    { symbol: 'COST', koreanName: '코스트코', sectorSymbol: 'XLP' },
    { symbol: 'PG', koreanName: '프록터앤드갬블', sectorSymbol: 'XLP' },
    { symbol: 'KO', koreanName: '코카콜라', sectorSymbol: 'XLP' },
    { symbol: 'PEP', koreanName: '펩시코', sectorSymbol: 'XLP' },
    { symbol: 'PM', koreanName: '필립모리스', sectorSymbol: 'XLP' },
    // Industrials (XLI) — 6
    { symbol: 'CAT', koreanName: '캐터필러', sectorSymbol: 'XLI' },
    { symbol: 'HON', koreanName: '하니웰', sectorSymbol: 'XLI' },
    { symbol: 'UNP', koreanName: '유니온퍼시픽', sectorSymbol: 'XLI' },
    { symbol: 'GE', koreanName: 'GE에어로스페이스', sectorSymbol: 'XLI' },
    { symbol: 'RTX', koreanName: 'RTX', sectorSymbol: 'XLI' },
    { symbol: 'DE', koreanName: '디어앤드컴퍼니', sectorSymbol: 'XLI' },
    // Materials (XLB) — 5
    { symbol: 'LIN', koreanName: '린데', sectorSymbol: 'XLB' },
    { symbol: 'APD', koreanName: '에어프로덕츠', sectorSymbol: 'XLB' },
    { symbol: 'ECL', koreanName: '에코랩', sectorSymbol: 'XLB' },
    { symbol: 'NEM', koreanName: '뉴몬트', sectorSymbol: 'XLB' },
    { symbol: 'FCX', koreanName: '프리포트맥모란', sectorSymbol: 'XLB' },
    // Utilities (XLU) — 5
    { symbol: 'NEE', koreanName: '넥스트에라에너지', sectorSymbol: 'XLU' },
    { symbol: 'DUK', koreanName: '듀크에너지', sectorSymbol: 'XLU' },
    { symbol: 'SO', koreanName: '서던컴퍼니', sectorSymbol: 'XLU' },
    { symbol: 'AEP', koreanName: '아메리칸일렉트릭', sectorSymbol: 'XLU' },
    { symbol: 'EXC', koreanName: '엑셀론', sectorSymbol: 'XLU' },
    // Real Estate (XLRE) — 5
    { symbol: 'AMT', koreanName: '아메리칸타워', sectorSymbol: 'XLRE' },
    { symbol: 'PLD', koreanName: '프로로지스', sectorSymbol: 'XLRE' },
    { symbol: 'EQIX', koreanName: '에퀴닉스', sectorSymbol: 'XLRE' },
    { symbol: 'CCI', koreanName: '크라운캐슬', sectorSymbol: 'XLRE' },
    { symbol: 'PSA', koreanName: '퍼블릭스토리지', sectorSymbol: 'XLRE' },
    // Communication Services (XLC) — 6
    { symbol: 'GOOGL', koreanName: '알파벳', sectorSymbol: 'XLC' },
    { symbol: 'META', koreanName: '메타', sectorSymbol: 'XLC' },
    { symbol: 'NFLX', koreanName: '넷플릭스', sectorSymbol: 'XLC' },
    { symbol: 'DIS', koreanName: '디즈니', sectorSymbol: 'XLC' },
    { symbol: 'CMCSA', koreanName: '컴캐스트', sectorSymbol: 'XLC' },
    { symbol: 'T', koreanName: 'AT&T', sectorSymbol: 'XLC' },
    // Quantum (QNTM) — 6 (virtual sector, no ETF)
    { symbol: 'IONQ', koreanName: '아이온큐', sectorSymbol: 'QNTM' },
    { symbol: 'LAES', koreanName: 'SEALSQ', sectorSymbol: 'QNTM' },
    { symbol: 'RGTI', koreanName: '리게티 컴퓨팅', sectorSymbol: 'QNTM' },
    { symbol: 'QBTS', koreanName: '디웨이브 퀀텀', sectorSymbol: 'QNTM' },
    { symbol: 'QUBT', koreanName: '퀀텀 컴퓨팅', sectorSymbol: 'QNTM' },
    { symbol: 'IBM', koreanName: '아이비엠', sectorSymbol: 'QNTM' },
];

// Timeframes supported by Panel C sector signal dashboard
export const DASHBOARD_TIMEFRAMES: readonly DashboardTimeframe[] = [
    '15Min',
    '1Hour',
    '1Day',
];

export const DEFAULT_DASHBOARD_TIMEFRAME: DashboardTimeframe = '1Day';

export const DASHBOARD_TIMEFRAME_LABELS: Record<DashboardTimeframe, string> = {
    '15Min': '15분',
    '1Hour': '1시간',
    '1Day': '1일',
};

// Panel C sector tabs — SECTOR_ETFS + virtual Quantum sector (no ETF)
export const SIGNAL_SECTORS: readonly SectorEtf[] = [
    ...SECTOR_ETFS,
    { symbol: 'QNTM', sectorName: 'Quantum', koreanName: '양자' },
];
