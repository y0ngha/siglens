import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import koMessages from '../../../../messages/ko.json';
import { pickMessages } from '../loadMessages';
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
            koMessages,
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
            pickMessages(koMessages, CHROME_CLIENT_PATHS)
        ).length;
        // 합집합이던 시절 24,299바이트(60.9%)였다.
        expect(chrome / full).toBeLessThan(0.15);
    });
});
