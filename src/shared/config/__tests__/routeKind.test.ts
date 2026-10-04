import { routeKindOf } from '@/shared/config/routeKind';

describe('routeKindOf', () => {
    it.each([
        ['/', 'home'],
        ['/?q=aapl', 'home'],
        ['/market', 'market'],
        ['/market/kr', 'market'],
        ['/fear-greed', 'fearGreed'],
        ['/fear-greed/crypto', 'fearGreed'],
        ['/economy', 'economy'],
        ['/economy/kr', 'economy'],
        ['/news', 'news'],
        ['/news/us', 'news'],
        ['/news/stock', 'news'],
        ['/symbols', 'symbols'],
        ['/backtesting', 'backtesting'],
        ['/about', 'article'],
        ['/methodology', 'article'],
        ['/privacy', 'legal'],
        ['/terms', 'legal'],
        ['/login', 'auth'],
        ['/login?next=%2Fportfolio', 'auth'],
        ['/signup', 'auth'],
        ['/signup/oauth/consent', 'auth'],
        ['/forgot-password', 'auth'],
        ['/reset-password', 'auth'],
        ['/account', 'account'],
        ['/account/delete', 'account'],
        ['/portfolio', 'portfolio'],
        ['/share/abc123', 'share'],
        ['/AAPL', 'symbol'],
        ['/AAPL/news', 'symbol'],
        ['/005930.KS', 'symbol'],
        ['/BTCUSD/overall', 'symbol'],
    ] as const)('%s → %s', (path, kind) => {
        expect(routeKindOf(path)).toBe(kind);
    });

    it('예약 세그먼트지만 골격이 따로 없는 경로는 generic이다', () => {
        expect(routeKindOf('/lp/stock-analysis')).toBe('generic');
        expect(routeKindOf('/onboarding')).toBe('generic');
    });

    it('프로토타입 키를 라우트로 오인하지 않는다', () => {
        expect(routeKindOf('/__proto__')).toBe('generic');
    });
});
