import type { DashboardScope } from '@/shared/config/dashboardScope';

/**
 * 대시보드 위젯 테스트용 결정적 scope.
 *
 * 예전에는 `vi.mock('@/shared/config/dashboard-tickers')`로 모듈을 통째로 가로챘는데,
 * 지금은 설정이 `scope` prop으로 흐르므로 목이 필요 없다. 목을 쓰면 실제 설정에
 * export가 하나 늘 때마다 "mock에 없다"로 무관한 테스트가 깨진다 —
 * 실제로 그렇게 깨졌다.
 *
 * 미국 실제 설정보다 작게 잡아 렌더 개수 단언을 눈으로 셀 수 있게 한다.
 */
export const TEST_SCOPE: DashboardScope = {
    id: 'us',
    marketLabel: '미국 증시',
    currencySymbol: '$',
    linkSectorCards: true,
    volatilityIndexSymbol: 'VIX',
    tickerIsReadable: true,
    indices: [
        { symbol: 'SPY', fmpSymbol: 'SPY', displayName: 'SPY', koreanName: '' },
        { symbol: 'QQQ', fmpSymbol: 'QQQ', displayName: 'QQQ', koreanName: '' },
        { symbol: 'DIA', fmpSymbol: 'DIA', displayName: 'DIA', koreanName: '' },
        { symbol: 'IWM', fmpSymbol: 'IWM', displayName: 'IWM', koreanName: '' },
    ],
    sectorEtfs: [
        { symbol: 'XLK', sectorName: 'Technology', koreanName: '기술' },
        { symbol: 'XLE', sectorName: 'Energy', koreanName: '에너지' },
        { symbol: 'XLC', sectorName: 'Comm. Svc.', koreanName: '통신서비스' },
        { symbol: 'XLY', sectorName: 'Cons. Disc.', koreanName: '경기소비재' },
        { symbol: 'XLF', sectorName: 'Financials', koreanName: '금융' },
        { symbol: 'XLV', sectorName: 'Healthcare', koreanName: '헬스케어' },
        { symbol: 'XLI', sectorName: 'Industrials', koreanName: '산업재' },
        {
            symbol: 'XLP',
            sectorName: 'Cons. Staples',
            koreanName: '필수소비재',
        },
    ],
    sectorGroups: [
        { label: 'Tech', symbols: ['XLK', 'XLC', 'XLY'] },
        { label: 'Finance', symbols: ['XLF', 'XLV', 'XLI', 'XLP'] },
    ],
    signalSectors: [
        { symbol: 'XLK', sectorName: 'Technology', koreanName: '기술' },
        { symbol: 'XLV', sectorName: 'Healthcare', koreanName: '헬스케어' },
        { symbol: 'XLF', sectorName: 'Financials', koreanName: '금융' },
    ],
    sectorStocks: [
        { symbol: 'AAPL', koreanName: '애플', sectorSymbol: 'XLK' },
        { symbol: 'JPM', koreanName: 'JP모간', sectorSymbol: 'XLF' },
    ],
};
