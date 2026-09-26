import { CHROME_CLIENT_PATHS, routeClientPaths } from '../clientNamespaces';

describe('routeClientPaths', () => {
    it('알려진 라우트는 해당 라우트의 키 목록을 반환한다', () => {
        const paths = routeClientPaths('market');
        expect(paths.length).toBeGreaterThan(0);
        expect(paths).not.toEqual(CHROME_CLIENT_PATHS);
    });

    /**
     * `generated.routes`에 없는 라우트 id — 새 페이지를 추가하고
     * `yarn i18n:extract`를 아직 안 돌린 경우다. 크롬으로 떨어져야 최소한
     * 크롬 키만큼은 렌더된다(빈 화면보다 낫다).
     */
    it('알 수 없는 라우트는 크롬 키 목록으로 폴백한다', () => {
        expect(routeClientPaths('__no-such-route__')).toEqual(
            CHROME_CLIENT_PATHS
        );
    });
});
