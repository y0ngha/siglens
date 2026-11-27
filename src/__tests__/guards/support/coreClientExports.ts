import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildImportGraph, fileImports, SRC } from './importGraph';

/**
 * 클라이언트 번들에 실리는 파일이 `@y0ngha/siglens-core`에서 가져오는 값이 core의 **브라우저
 * 진입점**(`package.json` `exports.browser` → `dist/index.client.js`)에 있는지 보는 소스 워커.
 *
 * 번들러는 브라우저 번들에서 `browser` 조건으로, Vitest·서버는 `default`(`dist/index.js`)로
 * core를 푼다. 서버 진입점에만 있는 심볼을 클라이언트 코드가 import하면 빌드와 단위
 * 테스트는 통과하고 브라우저에서만 "X is not a function"으로 깨진다.
 *
 * 클라이언트 그래프 = `'use client'` 파일 + 거기서 정적·동적 import(`export … from` 포함)로
 * 닿는 모듈. 서버 경계에서 멈춘다: `import 'server-only'` 파일, `'use server'` 파일(클라이언트가
 * 호출해도 서버에서 실행된다), `src/app/api/**`, `entities/<x>/api.ts`.
 *
 * 한계: 이름을 알 수 없는 형태(이름공간 import, `export *`, `import()`·`require()`)는 검사할 수
 * 없으므로 `*`로 보고한다 — 통과시키지 않고 위반으로 센다. `dist/index.client.d.ts`가 아니라
 * `.js`를 읽는 이유는 d.ts에 타입 전용 내보내기가 섞여 있고 런타임에 실제로 있는 값은 `.js`뿐이기
 * 때문이다.
 */

const CORE = '@y0ngha/siglens-core';
const CLIENT_ENTRY = path.resolve(
    SRC,
    '../node_modules/@y0ngha/siglens-core/dist/index.client.js'
);

export interface CoreViolation {
    /** `src/` 기준 상대경로. */
    file: string;
    line: number;
    symbol: string;
}

/**
 * 브라우저 진입점이 내보내는 값 이름. 실제로 값이 붙는 두 형태만 센다: `exports.X = <값>;`와
 * `Object.defineProperty(exports, "X", …)`. TS가 파일 머리에 깔아 두는 선언
 * `exports.a = exports.b = void 0;`는 값이 없는 이름까지 늘어놓으므로 세지 않는다.
 */
export function parseClientExports(source: string): Set<string> {
    const names = new Set<string>();
    for (const m of source.matchAll(
        /((?:\bexports\.[A-Za-z_$][\w$]*\s*=\s*)+)([^;\n]*)/g
    )) {
        if (/^void\s+0\b/.test(m[2].trim())) continue;
        for (const n of m[1].matchAll(/\bexports\.([A-Za-z_$][\w$]*)/g))
            names.add(n[1]);
    }
    for (const m of source.matchAll(
        /Object\.defineProperty\(exports,\s*["']([^"']+)["']/g
    ))
        names.add(m[1]);
    names.delete('__esModule');
    return names;
}

export const loadClientExports = (): Set<string> =>
    parseClientExports(readFileSync(CLIENT_ENTRY, 'utf8'));

const rel = (absolute: string): string =>
    path.relative(SRC, absolute).split(path.sep).join('/');

/** 클라이언트 그래프에서 걷지 않는 서버 경계 경로. */
export const isServerPath = (file: string): boolean =>
    file.startsWith('app/api/') || /^entities\/[^/]+\/api\.tsx?$/.test(file);

/**
 * `roots`(절대 경로, 호출부가 정한 클라이언트 경계)에서 값 import를 따라가며 서버 경계
 * 안쪽의 파일을 모은다.
 */
export function clientGraphFiles(roots: readonly string[]): string[] {
    const seen = new Set<string>();
    const walk = (file: string): void => {
        if (seen.has(file) || isServerPath(rel(file))) return;
        const { directive, imports } = fileImports(file);
        if (directive === 'use server') return;
        if (imports.some(i => i.specifier === 'server-only')) return;
        seen.add(file);
        // `import type`·전부 `type`인 지정자는 빌드에서 지워져 번들에 닿지 않는다.
        for (const { resolved, typeOnly } of imports)
            if (!typeOnly && typeof resolved === 'string') walk(resolved);
    };
    roots.forEach(walk);
    return [...seen];
}

/** `files`가 core에서 가져오는 값 중 `clientExports`에 없는 것(타입 전용 제외). */
export function findServerOnlyCoreImports(
    files: readonly string[],
    clientExports: ReadonlySet<string>
): CoreViolation[] {
    return files
        .flatMap(file =>
            fileImports(file)
                .imports.filter(i => i.specifier === CORE && !i.typeOnly)
                .flatMap(i =>
                    i.names
                        .filter(
                            name => name === '*' || !clientExports.has(name)
                        )
                        .map(symbol => ({
                            file: rel(file),
                            line: i.line,
                            symbol,
                        }))
                )
        )
        .sort(
            (a, b) =>
                a.file.localeCompare(b.file) ||
                a.line - b.line ||
                a.symbol.localeCompare(b.symbol)
        );
}

/** 클라이언트 경계의 시작점: `'use client'` 지시문이 있는 파일만. 서버 컴포넌트는 시작점이 아니다. */
export const useClientRoots = (files: readonly string[]): string[] =>
    files.filter(file => fileImports(file).directive === 'use client');

/** `src/` 전체에서 `'use client'` 파일을 시작점으로 한 클라이언트 그래프. */
export function repoClientGraph(): string[] {
    return clientGraphFiles(
        useClientRoots(
            buildImportGraph().files.map(file => path.join(SRC, file))
        )
    );
}
