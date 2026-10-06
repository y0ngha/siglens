import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import clientKeys from '../../../../messages/_meta/clientKeys.json';
import manualKeys from '../../../../messages/_meta/manualKeys.json';
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

/**
 * 페이지가 자기 `RouteMessages`를 렌더하면 추출기가 그 페이지 키를 레이아웃 엔트리에서 떼어
 * `<route>/(page)` 엔트리로 싣는다(`scripts/i18n/extract.mjs`). 그 짝이 어긋나면 —
 * 엔트리는 있는데 페이지가 렌더하지 않거나, 페이지가 엔트리에 없는 id를 쓰면
 * (`routeClientPaths`가 크롬으로 폴백해 차이가 비어 버린다) — 그 페이지의 키가 어디에도
 * 실리지 않아 화면에 키 문자열이 나온다.
 */
describe('페이지 단위 메시지 엔트리', () => {
    const routeIds = Object.keys(clientKeys.routes);
    const pageRouteIds = routeIds.filter(id => id.endsWith('/(page)'));

    it('차트 탭은 페이지 단위 엔트리를 갖는다', () => {
        expect(pageRouteIds).toContain('[symbol]/(page)');
    });

    it.each(pageRouteIds)('%s 는 그 페이지가 렌더한다', routeId => {
        const page = readFileSync(
            join(
                process.cwd(),
                'src/app/[locale]',
                routeId.slice(0, -'/(page)'.length),
                'page.tsx'
            ),
            'utf8'
        );
        expect(page).toContain(`<RouteMessages route="${routeId}"`);
    });

    it('[symbol] 레이아웃·차트 페이지가 렌더하는 route는 모두 엔트리에 있다', () => {
        const rendered = [
            'src/app/[locale]/[symbol]/layout.tsx',
            'src/app/[locale]/[symbol]/page.tsx',
        ].flatMap(path =>
            [
                ...readFileSync(join(process.cwd(), path), 'utf8').matchAll(
                    /<RouteMessages\s+route="([^"]+)"/g
                ),
            ].map(m => m[1]!)
        );
        expect(rendered).toEqual(
            expect.arrayContaining(['[symbol]', '[symbol]/(page)'])
        );
        for (const id of rendered) expect(routeIds).toContain(id);
    });

    it('manualKeys.routeWide 가 가리키는 라우트 id는 모두 엔트리에 있다', () => {
        for (const ids of Object.values(manualKeys.routeWide)) {
            for (const id of ids) expect(routeIds).toContain(id);
        }
    });
});

/**
 * 차트·AI 패널 키는 차트 탭(`[symbol]/page.tsx`)만 쓴다. `[symbol]` 레이아웃 엔트리에
 * 있으면 레이아웃 메시지를 상속하는 형제 탭(뉴스·재무·옵션 …) 전부가 받는다.
 */
describe('차트 탭 전용 키는 형제 탭에 실리지 않는다', () => {
    // `widgets.chart` 통째가 아니다 — 공포·탐욕 탭이 `FearGreedHistoricalChart` 키를 쓴다.
    const CHART_ONLY = [
        'widgets.chart.StockChart',
        'widgets.chart.indicatorCategory',
        'widgets.analysis.AnalysisPanel',
        'widgets.chart.TimeframeSelector',
        'views.symbol.SymbolPageClient',
        'views.symbol.technicalFacts',
        'shared.skillName',
    ];
    const reaches = (paths: readonly string[], prefix: string) =>
        paths.some(path => path === prefix || path.startsWith(`${prefix}.`));
    const siblingTabs = Object.keys(clientKeys.routes).filter(
        id => id.startsWith('[symbol]/') && id !== '[symbol]/(page)'
    );

    it('형제 탭을 실제로 수집한다', () => {
        expect(siblingTabs).toEqual(
            expect.arrayContaining(['[symbol]/news', '[symbol]/fundamental'])
        );
    });

    it.each(CHART_ONLY)('[symbol]/(page) 는 %s 를 받는다', prefix => {
        expect(reaches(routeClientPaths('[symbol]/(page)'), prefix)).toBe(true);
    });

    it.each(CHART_ONLY)('[symbol] 레이아웃은 %s 를 싣지 않는다', prefix => {
        expect(reaches(routeClientPaths('[symbol]'), prefix)).toBe(false);
    });

    it.each(siblingTabs)('%s 는 차트 전용 키를 받지 않는다', routeId => {
        const received = [
            ...ancestorClientPaths(routeId),
            ...routeClientPaths(routeId),
        ];
        expect(CHART_ONLY.filter(prefix => reaches(received, prefix))).toEqual(
            []
        );
    });

    it('차트 탭은 [symbol] 레이아웃 엔트리를 상위로 본다(차이만 보낸다)', () => {
        const ancestors = new Set(ancestorClientPaths('[symbol]/(page)'));
        for (const path of routeClientPaths('[symbol]')) {
            expect(ancestors.has(path)).toBe(true);
        }
    });
});
