import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import koMessages from '../../../../messages/ko.json';
import { pickMessages } from '../loadMessages';
import type { AbstractIntlMessages } from 'next-intl';

/**
 * next-intl의 `AbstractIntlMessages`는 **배열 값을 모델링하지 않는다**.
 * 툴팁 문단은 실제로 배열이고 `TooltipParagraphs`가 `t.raw()`로 읽는다 —
 * 런타임 계약은 맞는데 정적 import의 추론 타입만 시그니처와 어긋난다.
 * 그래서 여기서만 좁힌다(프로덕션 로더는 동적 import라 이 문제가 없다).
 */
const messages = koMessages as unknown as AbstractIntlMessages;
import { CHROME_CLIENT_PATHS, routeClientPaths } from '../clientNamespaces';

const ROOT = process.cwd();
const SRC = join(ROOT, 'src');
const APP = join(SRC, 'app/[locale]');

function collect(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name === '__tests__' || name === 'test-utils') continue;
            collect(full, acc);
        } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\./.test(name)) {
            acc.push(full);
        }
    }
    return acc;
}

const ALL = collect(SRC);
const SOURCE = new Map(ALL.map(f => [f, readFileSync(f, 'utf8')]));

function resolveSpec(from: string, spec: string): string | undefined {
    let base: string;
    if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
    else if (spec.startsWith('.')) base = join(from, '..', spec);
    else return undefined;
    for (const cand of [
        base,
        `${base}.ts`,
        `${base}.tsx`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
    ]) {
        if (SOURCE.has(cand)) return cand;
    }
    return undefined;
}

function importsOf(file: string): string[] {
    const code = SOURCE.get(file) ?? '';
    const specs = [
        ...[...code.matchAll(/from\s+'([^']+)'/g)].map(m => m[1]!),
        // `next/dynamic(() => import('./X'))`도 클라이언트 번들에 들어간다.
        ...[...code.matchAll(/import\(\s*'([^']+)'\s*\)/g)].map(m => m[1]!),
    ];
    return specs
        .map(spec => resolveSpec(file, spec))
        .filter((f): f is string => f !== undefined);
}

const isClientDirective = (file: string) =>
    /^\s*(['"])use client\1/m.test((SOURCE.get(file) ?? '').slice(0, 400));

/** 진입점에서 도달 가능한 클라이언트 번들 파일. */
function clientClosure(entryPoints: string[]): string[] {
    const reachable = new Set(entryPoints);
    const q1 = [...entryPoints];
    while (q1.length > 0) {
        for (const t of importsOf(q1.pop()!)) {
            if (!reachable.has(t)) {
                reachable.add(t);
                q1.push(t);
            }
        }
    }
    const client = new Set<string>();
    const q2: string[] = [];
    for (const f of reachable) {
        if (isClientDirective(f)) {
            client.add(f);
            q2.push(f);
        }
    }
    while (q2.length > 0) {
        for (const t of importsOf(q2.pop()!)) {
            if (!client.has(t)) {
                client.add(t);
                q2.push(t);
            }
        }
    }
    return [...client];
}

function resolve(tree: unknown, path: string): unknown {
    return path
        .split('.')
        .reduce<unknown>(
            (node, seg) =>
                typeof node === 'object' && node !== null
                    ? (node as Record<string, unknown>)[seg]
                    : undefined,
            tree
        );
}

/** 파일이 참조하는 리터럴 키. 카탈로그에 실재하는 조합만 남긴다. */
function referencedKeys(file: string): string[] {
    const code = SOURCE.get(file) ?? '';
    const names = [
        ...code.matchAll(
            /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\s*\(/g
        ),
    ].map(m => m[1]!);
    if (names.length === 0) return [];
    const namespaces = [...code.matchAll(/useTranslations\(\s*'([^']+)'/g)].map(
        m => m[1]!
    );
    const out: string[] = [];
    for (const m of code.matchAll(
        new RegExp(`\\b(?:${names.join('|')})\\(\\s*'([A-Za-z0-9_.$-]+)'`, 'g')
    )) {
        const literal = m[1]!;
        const candidates =
            literal.split('.').length >= 3
                ? [literal]
                : namespaces.map(ns => `${ns}.${literal}`);
        out.push(
            ...candidates.filter(c => resolve(koMessages, c) !== undefined)
        );
    }
    return out;
}

/** `[locale]` 아래의 모든 라우트 파일(page + 경계). */
function routeFiles(dir: string, acc: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            if (name === '__tests__') continue;
            routeFiles(full, acc);
        } else if (
            /^(page|error|loading|not-found|template)\.tsx$/.test(name)
        ) {
            acc.push(full);
        }
    }
    return acc;
}

/**
 * 이 파일이 **실제로 렌더될 때** 위에 있는 프로바이더의 라우트 id.
 *
 * 가장 가까운 조상 `layout.tsx`를 찾아 그 라우트 id를 읽는다. `[locale]`까지
 * 올라가면 크롬(`null`)이다. 추출기의 모델을 그대로 베끼면 추출기가 자기 자신과
 * 일치한다는 것만 확인하게 되므로, 여기서는 **소스 트리에서 직접** 판정한다.
 */
function providerRouteFor(file: string): string | null {
    let dir = join(file, '..');
    while (dir.length > APP.length) {
        const layout = join(dir, 'layout.tsx');
        if (SOURCE.has(layout)) {
            const source = SOURCE.get(layout)!;
            // 대부분은 `routeLayout('market')` 팩토리 한 줄이고,
            // `[symbol]/layout.tsx`만 손으로 쓴 `route="[symbol]"` JSX다.
            const m =
                source.match(/routeLayout\(\s*'([^']+)'\s*\)/) ??
                source.match(/route="([^"]+)"/);
            return m ? m[1]! : null;
        }
        dir = join(dir, '..');
    }
    return null;
}

/**
 * 라우트 파일의 클라이언트 서브트리가 참조하는 키가 **그 파일 위에 실제로 있는
 * 프로바이더에** 전부 들어 있는지 검증한다.
 *
 * 중첩 `NextIntlClientProvider`는 부모 메시지를 상속하지 않고 교체하므로,
 * 없는 키는 화면에 키 문자열로 나온다 — 빌드·타입체크·다른 테스트는 전부 통과한
 * 채로. 실측 전례: 라운드 2의 좁히기가 `[locale]/error.tsx`와
 * `[locale]/share/error.tsx`의 키를 어느 엔트리에도 넣지 않아, 두 에러 경계가
 * `app.home.error.80dac7` 같은 **원시 키를 `<h1>`으로** 렌더했다.
 * 컴포넌트 테스트로는 못 잡는다 — `intlRenderWrapper`가 ko 카탈로그 전체를 넣는다.
 */
describe('라우트별 클라이언트 메시지 커버리지', () => {
    const ROUTE_FILES = routeFiles(APP);

    it('라우트 파일을 실제로 수집한다', () => {
        expect(ROUTE_FILES.length).toBeGreaterThan(35);
    });

    it('경계 파일(error/loading/not-found)도 수집한다', () => {
        expect(
            ROUTE_FILES.filter(f => f.endsWith('error.tsx')).length
        ).toBeGreaterThan(5);
    });

    it.each(ROUTE_FILES)('%s', file => {
        const route = providerRouteFor(file);
        const picked = pickMessages(
            messages,
            route === null ? CHROME_CLIENT_PATHS : routeClientPaths(route)
        );
        const missing: string[] = [];
        for (const f of clientClosure([file])) {
            for (const key of referencedKeys(f)) {
                if (resolve(picked, key) === undefined) {
                    missing.push(`${relative(ROOT, f)}: ${key}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });

    it('크롬 페이로드가 합집합보다 훨씬 작다', () => {
        const full = JSON.stringify(koMessages).length;
        const chrome = JSON.stringify(
            pickMessages(messages, CHROME_CLIENT_PATHS)
        ).length;
        // 합집합이던 시절 24,299바이트(60.9%)였다.
        //
        // 한때 `shared.skillDescription` 때문에 0.238까지 부풀어 임계값을
        // 0.25로 올렸는데, 원인은 그 테이블이 아니라 **배럴 import 하나**였다.
        // 그걸 잡고 나서 임계값을 0.10으로 되돌렸다 — 실측치를 수용하려고
        // 상한을 올리는 건 가드를 끄는 것과 같다.
        //
        // 크롬은 모든 라우트에 상속 없이 복제되므로(중첩 프로바이더가 부모
        // 메시지를 교체) 크롬 크기가 곧 전 라우트 first-load의 하한이다.
        expect(chrome / full).toBeLessThan(0.1);
    });
});

/**
 * **동적 조회 테이블은 소비 라우트의 페이로드에 실려야 한다 — 거기에만.**
 *
 * 이 파일의 다른 단언들은 `t('literal')`만 본다 — 추출기와 **같은 모델**이라
 * 둘이 사이좋게 틀릴 수 있고, 실제로 그렇게 됐다. 표시명 조회 키 60개가
 * 페이로드에서 통째로 빠졌는데 전 게이트가 초록이었다(전 로케일 한국어 렌더).
 * 컴포넌트 테스트는 **전체 카탈로그**로 렌더되므로 이 축소를 구조적으로 못 본다.
 *
 * 반대 방향도 같이 잠근다. 한때 두 표를 `chromeWide`에 넣어 32개 라우트 전부에
 * 실었는데, `/login`·`/terms`처럼 이 표를 **렌더하지 않는** 라우트에까지 1.3KB가
 * 딸려갔다 — `manualKeys.json`이 스스로 금지한 바로 그 형태다. 추출기의 동적 키
 * 판정이 소비 라우트만 정확히 넓히므로, 크롬에 있으면 그건 과적재다.
 */
describe('동적 조회 테이블이 소비 라우트에만 실린다', () => {
    const table = (paths: readonly string[], name: 'assetName' | 'skillName') =>
        Object.keys(
            (
                pickMessages(messages, paths) as {
                    shared?: Record<string, object>;
                }
            ).shared?.[name] ?? {}
        ).length;

    it.each([
        ['market', 'assetName'],
        ['market/kr', 'assetName'],
        ['[symbol]', 'skillName'],
        ['share/[id]', 'skillName'],
    ] as const)('%s 는 %s 표를 받는다', (routeId, name) => {
        expect(table(routeClientPaths(routeId), name)).toBeGreaterThan(20);
    });

    it.each([
        ['login', 'assetName'],
        ['terms', 'assetName'],
        ['[symbol]', 'assetName'],
    ] as const)('%s 는 %s 표를 받지 않는다', (routeId, name) => {
        expect(table(routeClientPaths(routeId), name)).toBe(0);
    });

    /**
     * 스킬 카탈로그는 **홈과 종목 라우트에만** 실린다.
     *
     * 한때 크롬에 있었다 — 홈이 자기 세그먼트 레이아웃이 없어 크롬 프로바이더를
     * 썼기 때문이다. 그 결과 `shared.skillDescription`(8.4KB)이 `/login`·
     * `/terms`까지 따라다녔고 크롬이 카탈로그의 23.8%였다. 홈을 라우트 그룹
     * `(home)`으로 옮기고, 404 경계가 `@/widgets/home` **배럴**을 타던 것을
     * 파일 직접 import로 끊어 7.3%가 됐다.
     */
    it.each([
        ['(home)', 'skillName'],
        ['(home)', 'skillDescription'],
        ['[symbol]', 'skillName'],
    ] as const)('%s 는 shared.%s 을 받는다', (routeId, table) => {
        const picked = pickMessages(messages, routeClientPaths(routeId)) as {
            shared?: Record<string, object>;
        };

        expect(
            Object.keys(picked.shared?.[table] ?? {}).length
        ).toBeGreaterThan(20);
    });

    it.each(['skillName', 'skillDescription'] as const)(
        '크롬에는 shared.%s 이 없다',
        table => {
            const picked = pickMessages(messages, CHROME_CLIENT_PATHS) as {
                shared?: Record<string, object>;
            };

            expect(Object.keys(picked.shared?.[table] ?? {})).toEqual([]);
        }
    );

    /**
     * `shared.seo`는 **서버 전용**이다 — `generateMetadata`와 서버 컴포넌트만
     * 읽는다. 클라이언트 페이로드에 들어가면 SEO 제목·설명 전부가 모든 라우트에
     * 실린다(실측: 크롬이 카탈로그의 21.8%까지 부풀었다).
     */
    it('shared.seo 는 어떤 클라이언트 페이로드에도 없다', () => {
        const buckets = [
            CHROME_CLIENT_PATHS,
            ...['market', '[symbol]', 'login', 'terms', 'privacy'].map(
                routeClientPaths
            ),
        ];

        for (const paths of buckets) {
            expect(
                (pickMessages(messages, paths) as { shared?: object }).shared ??
                    {}
            ).not.toHaveProperty('seo');
        }
    });
});
