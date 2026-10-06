import generated from '../../../messages/_meta/clientKeys.json';

interface KeySet {
    readonly keys: readonly string[];
    readonly wideNamespaces: readonly string[];
}

const flatten = (set: KeySet): readonly string[] => [
    ...set.wideNamespaces,
    ...set.keys,
];

/**
 * ⚠️ 이 목록은 `yarn i18n:extract`가 생성한다(`messages/_meta/clientKeys.json`).
 * 손으로 고치지 말 것 — 새 클라이언트 컴포넌트가 추가될 때마다 빠뜨리게 되고,
 * 그 누락은 빌드가 아니라 런타임 `MISSING_MESSAGE`로만 드러난다.
 *
 * ## 왜 라우트별로 쪼개는가
 *
 * 루트 프로바이더 하나에 전 라우트 키의 합집합을 실으면 `/login`·`/terms` 같은
 * 가벼운 페이지가 `widgets.options`·`views.symbol`·`widgets.chat`을 통째로
 * 들고 다닌다. 실측: 전 라우트에 24,299바이트가 동일하게 실려 **first-load JS
 * +28%, RSC prefetch +45.8%**였다 — v0.58.0(first-load −38%)과 PR #719(RSC
 * 페이로드) 성과를 정면으로 되돌리는 크기다.
 *
 * ## 왜 키 단위인가
 *
 * 네임스페이스 단위로는 슬라이스에 클라이언트 파일이 **하나만** 있어도 그
 * 슬라이스의 서버 전용 키까지 전부 딸려갔다(1,035/1,075키 = 96.3%).
 *
 * ## 동적 키 파일은 좁히지 않는다
 *
 * `t(item.labelKey)`처럼 키가 변수로 오는 파일은 정적으로 볼 수 없다. 그런
 * 파일의 네임스페이스는 `wideNamespaces`로 통째 유지한다 — 빠뜨리면 빌드·
 * 타입체크·테스트를 모두 통과한 채 화면에서만 키 문자열이 나온다(전례 5,184건).
 */
export const CHROME_CLIENT_PATHS: readonly string[] = flatten(generated.chrome);

const ROUTES = generated.routes as Record<string, KeySet>;

/**
 * 라우트 서브트리에 실을 경로 목록.
 *
 * **크롬 키를 포함한다.** 중첩 `NextIntlClientProvider`는 부모 메시지를
 * 상속하지 않고 **교체**하므로(`use-intl`의
 * `messages === undefined ? prevContext?.messages : messages`), 페이지
 * 프로바이더는 자기 완결이어야 한다. 페이지 서브트리가 크롬 키를 하나라도
 * 쓰면 그 자리만 키 문자열로 노출된다.
 *
 * 모르는 라우트는 크롬으로 떨어진다 — 새 페이지를 추가하고 추출을 안 돌린
 * 경우인데, 그 누락은 `clientKeyCoverage` 테스트가 잡는다.
 */
export function routeClientPaths(routeId: string): readonly string[] {
    const set = ROUTES[routeId];
    return set ? flatten(set) : CHROME_CLIENT_PATHS;
}

/**
 * `routeId`보다 **위에서** 이미 클라이언트에 실린 경로 — 크롬과, 경로상 상위 라우트(세그먼트
 * 접두사)의 경로 전부.
 *
 * 상위 라우트는 자기 `layout.tsx`에서 `RouteMessages`를 렌더하므로(`routeLayout`·`[symbol]`
 * 레이아웃) 그 메시지는 하위 서브트리의 `MergedIntlProvider`가 이어받는다. 이 전제는
 * `clientNamespaces.test.ts`가 "접두사 라우트마다 메시지 레이아웃이 있다"로 고정한다.
 *
 * 페이지 단위 엔트리 `<route>/(page)`(자기 `RouteMessages`를 렌더하는 페이지 — 지금은
 * `[symbol]` 차트 탭뿐이다)도 같은 규칙을 탄다. 접두사 `<route>`가 레이아웃 엔트리라
 * 레이아웃이 실은 키는 빼고 페이지 몫만 보낸다. 반대로 `(page)` 엔트리는 다른 라우트의
 * 접두사가 아니므로 형제 탭은 그 키를 받지 않는다 — 이게 이 엔트리를 따로 두는 이유다.
 */
export function ancestorClientPaths(routeId: string): readonly string[] {
    const segments = routeId.split('/');
    const ancestors = segments
        .slice(0, -1)
        .map((_, i) => segments.slice(0, i + 1).join('/'))
        .filter(prefix => prefix in ROUTES);
    return [
        ...new Set([
            ...CHROME_CLIENT_PATHS,
            ...ancestors.flatMap(prefix => flatten(ROUTES[prefix]!)),
        ]),
    ];
}

/** 메시지 레이아웃이 있어야 하는(하위 라우트를 가진) 라우트 id. 가드 테스트용. */
export function routesWithDescendants(): readonly string[] {
    const ids = Object.keys(ROUTES);
    return ids.filter(id => ids.some(other => other.startsWith(`${id}/`)));
}
