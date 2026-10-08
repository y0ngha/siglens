import { routeKindOf } from '@/shared/config/routeKind';
import { RESERVED_FIRST_SEGMENTS } from '@/shared/config/reservedFirstSegments';
import { LOCALES } from '@/shared/i18n/locales';

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
        ['/email-report', 'account'],
        ['/email-report/unsubscribe?u=1&sig=x', 'account'],
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

    /**
     * 새 최상위 라우트를 만들고 여기 분류를 안 넣으면 `generic` 골격으로 조용히 떨어진다.
     * 예약 세그먼트 전부를 돌려, 골격이 따로 없는 것은 아래 목록에 **명시된 것뿐**임을 고정한다 —
     * 라우트를 추가하면 이 테스트가 분류를 정하라고 알려 준다.
     */
    it('예약 세그먼트 중 generic인 것은 허용 목록뿐이다', () => {
        // 로케일 접두사(앱 경로에는 나타나지 않는다)와 페이지가 아닌 세그먼트.
        const notPages = new Set<string>([...LOCALES, 'api', '_next']);
        // 골격을 따로 두지 않기로 한 페이지: 광고 랜딩(별도 루트, 클라이언트 이동 대상이
        // 아님)과 삭제된 `/onboarding`(레거시 리다이렉트 대상).
        const genericByDesign = ['lp', 'onboarding'];

        const generic = [...RESERVED_FIRST_SEGMENTS]
            .filter(segment => !notPages.has(segment))
            .filter(segment => routeKindOf(`/${segment}`) === 'generic');

        expect(generic.toSorted()).toEqual(genericByDesign.toSorted());
    });
});
