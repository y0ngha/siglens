import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { blankComments } from './support/sourceScan';

/**
 * **라우트 모듈은 Next가 인식하는 export만 둔다** (`src/app/CLAUDE.md#AP-6`).
 *
 * 테스트용으로 컴포넌트·헬퍼를 라우트 파일에서 export하면 `next typegen`·tsc가 잡지 못한 채 라우트 모듈
 * 계약을 벗어난다. 그런 코드는 `_components/`·`_lib/`에 정의하고 거기서 import한다. 타입 전용 export는
 * 런타임에 지워져 허용한다.
 *
 * 범위: `src/app/[locale]/[symbol]/**`의 라우트 모듈 파일.
 */
const SCOPE_DIR = path.resolve(__dirname, '../../app/[locale]/[symbol]');

const ROUTE_MODULE_FILES = new Set([
    'page.tsx',
    'layout.tsx',
    'error.tsx',
    'not-found.tsx',
    'loading.tsx',
    'opengraph-image.tsx',
    'twitter-image.tsx',
]);

const IMAGE_FILES = new Set(['opengraph-image.tsx', 'twitter-image.tsx']);

/** Next가 라우트 모듈에서 읽는 export(메타데이터·segment config). */
const ROUTE_EXPORTS: ReadonlySet<string> = new Set([
    'default',
    'generateMetadata',
    'metadata',
    'generateStaticParams',
    'revalidate',
    'dynamic',
    'dynamicParams',
    'fetchCache',
    'runtime',
    'preferredRegion',
    'maxDuration',
    'viewport',
    'generateViewport',
    'experimental_ppr',
]);

/** 메타데이터 이미지 파일이 추가로 갖는 export. */
const IMAGE_EXPORTS: ReadonlySet<string> = new Set([
    'size',
    'contentType',
    'alt',
    'generateImageMetadata',
]);

/** 범위 안 라우트 모듈의 경로(범위 기준 상대 경로, `/` 구분). */
function routeModules(): string[] {
    return readdirSync(SCOPE_DIR, { recursive: true, encoding: 'utf8' })
        .map(file => file.split(path.sep).join('/'))
        .filter(file => !file.includes('__tests__'))
        .filter(file => ROUTE_MODULE_FILES.has(path.posix.basename(file)))
        .sort();
}

/** `export { a, b as c, type T }` 목록의 런타임 이름(타입 전용 항목 제외, 별칭은 바깥 이름). */
function namesOfClause(clause: string): string[] {
    return clause
        .split(',')
        .map(item => item.trim())
        .filter(item => item !== '' && !item.startsWith('type '))
        .map(item => item.split(/\s+as\s+/).at(-1) ?? item);
}

/**
 * 소스가 내보내는 런타임 이름. 주석을 비운 뒤(`blankComments`) 최상위 `export` 문을 읽는다 — 라우트
 * 모듈은 포매터가 줄 머리에 `export`를 두므로 줄 단위로 충분하다. 타입 전용 선언(`interface`·`type`·
 * `export type { … }`)은 런타임에 지워져 세지 않는다. 이름을 알 수 없는 형태(`export *`·구조 분해)는
 * 허용 목록 밖 이름(`*`·`?`)으로 돌려 가드를 실패시킨다.
 */
function exportedNames(source: string): string[] {
    const code = blankComments(source);
    const clauses = [
        ...code.matchAll(/^export\s+(type\s+)?\{([^}]*)\}/gm),
    ].flatMap(m => (m[1] === undefined ? namesOfClause(m[2] ?? '') : []));
    const declarations = [...code.matchAll(/^export\s+(?!\{)(.*)$/gm)].flatMap(
        ([, rest = '']) => {
            if (/^(type|interface)\b/.test(rest)) return [];
            if (/^default\b/.test(rest)) return ['default'];
            if (rest.startsWith('*')) return ['*'];
            const named =
                /^(?:declare\s+)?(?:async\s+)?(?:function\*?|class|abstract\s+class|enum|const\s+enum|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(
                    rest
                );
            return [named?.[1] ?? '?'];
        }
    );
    return [...declarations, ...clauses];
}

describe('라우트 모듈 export 가드 (AP-6)', () => {
    const modules = routeModules();

    it('스캔 대상이 비어 있지 않고 레이아웃과 페이지를 포함한다', () => {
        expect(modules).toContain('layout.tsx');
        expect(modules).toContain('page.tsx');
        expect(modules.filter(file => file.endsWith('/page.tsx')).length).toBe(
            9
        );
    });

    it.each(modules)('%s는 Next가 인식하는 export만 둔다', file => {
        const source = readFileSync(path.join(SCOPE_DIR, file), 'utf8');
        const allowed = IMAGE_FILES.has(path.posix.basename(file))
            ? new Set([...ROUTE_EXPORTS, ...IMAGE_EXPORTS])
            : ROUTE_EXPORTS;
        const extra = exportedNames(source).filter(name => !allowed.has(name));
        expect(extra).toEqual([]);
    });

    describe('exportedNames', () => {
        it.each([
            ['export function Foo() {}', ['Foo']],
            [
                'export async function generateMetadata() {}',
                ['generateMetadata'],
            ],
            ['export const revalidate = 60; // 1m', ['revalidate']],
            ['export const { a } = obj;', ['?']],
            ['const a = 1;\nexport { a, a as b };', ['a', 'b']],
            ['export default function Page() {}', ['default']],
            ['const P = 1;\nexport default P;', ['default']],
            ['export class Foo {}', ['Foo']],
            ['export interface Props {}\nexport type T = string;', []],
            ["export type { X } from './x';", []],
            ["export { type X, y } from './x';", ['y']],
            ["export * from './x';", ['*']],
            [
                '// export function Commented() {}\n/* export const x = 1; */',
                [],
            ],
        ] as const)('%s → %j', (source, names) => {
            expect(exportedNames(source)).toEqual(names);
        });
    });
});
