// @vitest-environment node
import { routeLayout } from '../routeLayout';

/**
 * `routeLayout(route)`는 RSC 레이아웃 팩토리를 반환한다 — `RouteMessages` 테스트와
 * 같은 이유로 `render()` 없이 트리를 직접 검사한다.
 */
describe('routeLayout', () => {
    it('params의 locale을 RouteMessages에 그대로 흘려보낸다', async () => {
        const Layout = routeLayout('market');
        const tree = (await Layout({
            params: Promise.resolve({ locale: 'ja' }),
            children: <div data-testid="probe">probe</div>,
        })) as unknown as {
            props: { locale: string; route: string; children: unknown };
        };

        expect(tree.props.locale).toBe('ja');
        expect(JSON.stringify(tree.props.children)).toContain('probe');
    });

    /**
     * `[locale]` 세그먼트가 지원하지 않는 값이면(신뢰 경계) 기본 로케일로
     * 떨어진다 — 던지면 잘못된 URL 접두사가 500이 된다.
     */
    it('지원하지 않는 locale은 기본 로케일(ko)로 좁힌다', async () => {
        const Layout = routeLayout('market');
        const tree = (await Layout({
            params: Promise.resolve({ locale: 'xx' }),
            children: <div>x</div>,
        })) as unknown as { props: { locale: string } };

        expect(tree.props.locale).toBe('ko');
    });

    it('각 팩토리 호출은 자신의 route를 RouteMessages에 넘긴다', async () => {
        const Layout = routeLayout('news');
        const tree = (await Layout({
            params: Promise.resolve({ locale: 'ko' }),
            children: <div>x</div>,
        })) as unknown as { props: { route: string } };

        expect(tree.props.route).toBe('news');
    });
});
