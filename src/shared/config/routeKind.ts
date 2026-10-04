import { symbolOfAppPath } from './reservedFirstSegments';

/**
 * 앱 경로를 **골격 종류**로 분류한다 — 클릭 직후, 목적지 RSC가 오기 전에 어떤 모양의
 * 골격을 그릴지 정하는 데 쓴다(`NavigationPendingContext` JSDoc).
 *
 * 실제 페이지의 첫 화면 구조가 같은 라우트끼리 한 종류로 묶는다. 새 최상위 라우트를
 * 추가하고 여기 넣지 않으면 `generic` 골격이 뜬다(깨지지는 않는다).
 */
export type RouteKind =
    | 'home'
    | 'symbol'
    | 'market'
    | 'fearGreed'
    | 'economy'
    | 'news'
    | 'symbols'
    | 'backtesting'
    | 'article'
    | 'legal'
    | 'auth'
    | 'account'
    | 'portfolio'
    | 'share'
    | 'generic';

const KIND_BY_FIRST_SEGMENT: Readonly<Record<string, RouteKind>> = {
    market: 'market',
    'fear-greed': 'fearGreed',
    economy: 'economy',
    news: 'news',
    symbols: 'symbols',
    backtesting: 'backtesting',
    about: 'article',
    methodology: 'article',
    privacy: 'legal',
    terms: 'legal',
    login: 'auth',
    signup: 'auth',
    'forgot-password': 'auth',
    'reset-password': 'auth',
    account: 'account',
    portfolio: 'portfolio',
    share: 'share',
};

/** `appPath`는 로케일 접두사가 없는 앱 경로다(쿼리·해시는 있어도 된다). */
export function routeKindOf(appPath: string): RouteKind {
    const first = appPath.split(/[?#]/)[0]?.split('/')[1] ?? '';
    if (first === '') return 'home';
    if (Object.hasOwn(KIND_BY_FIRST_SEGMENT, first)) {
        return KIND_BY_FIRST_SEGMENT[first] as RouteKind;
    }
    return symbolOfAppPath(appPath) !== null ? 'symbol' : 'generic';
}
