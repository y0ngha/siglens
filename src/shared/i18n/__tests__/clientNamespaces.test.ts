import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    ancestorClientPaths,
    CHROME_CLIENT_PATHS,
    routeClientPaths,
    routesWithDescendants,
} from '../clientNamespaces';

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

describe('ancestorClientPaths', () => {
    it('최상위 라우트는 크롬 경로만 상위로 본다', () => {
        expect(ancestorClientPaths('market')).toEqual(CHROME_CLIENT_PATHS);
    });

    it('하위 라우트는 크롬과 접두사 라우트의 경로를 모두 상위로 본다', () => {
        const ancestors = new Set(ancestorClientPaths('[symbol]/news'));
        for (const path of routeClientPaths('[symbol]')) {
            expect(ancestors.has(path)).toBe(true);
        }
        for (const path of CHROME_CLIENT_PATHS) {
            expect(ancestors.has(path)).toBe(true);
        }
    });
});

/**
 * `RouteMessages`는 상위 라우트가 이미 실은 키를 빼고 보낸다(`ancestorClientPaths`). 그 전제는
 * "접두사 라우트가 자기 `layout.tsx`에서 `RouteMessages`를 렌더한다"이다. 접두사 라우트의
 * 레이아웃이 사라지거나 다른 라우트 id를 쓰면, 하위 페이지에서 그 키들이 조용히 원시 키
 * 문자열로 렌더된다 — 빌드·타입체크로는 드러나지 않는다.
 */
describe('하위 라우트를 가진 라우트는 메시지 레이아웃을 갖는다', () => {
    it.each(routesWithDescendants())('%s', routeId => {
        const layout = readFileSync(
            join(process.cwd(), 'src/app/[locale]', routeId, 'layout.tsx'),
            'utf8'
        );
        const rendersRouteMessages =
            layout.includes(`routeLayout('${routeId}')`) ||
            layout.includes(`<RouteMessages route="${routeId}"`);
        expect(rendersRouteMessages).toBe(true);
    });
});
