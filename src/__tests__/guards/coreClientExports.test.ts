import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    clientGraphFiles,
    findServerOnlyCoreImports,
    isServerPath,
    loadClientExports,
    parseClientExports,
    repoClientGraph,
    useClientRoots,
} from './support/coreClientExports';
import { SCAN_TIMEOUT_MS } from './support/controlUsage';

/**
 * 클라이언트 번들에 실리는 파일이 `@y0ngha/siglens-core`에서 가져오는 값은 core의 브라우저
 * 진입점(`dist/index.client.js`)에도 있어야 한다. 서버 진입점에만 있는 심볼은 빌드와 Vitest(node
 * 진입점)를 통과하고 브라우저에서만 "X is not a function"으로 깨진다.
 *
 * 판정 워커는 `support/coreClientExports.ts`(그래프 범위와 한계는 그 파일 머리). 기준선이 없다 —
 * 위반 0건이 기준이고, 예외를 두려면 이 가드를 의도적으로 고쳐야 한다.
 */

describe('클라이언트 그래프의 core import는 브라우저 진입점에 있다', () => {
    it(
        '브라우저 진입점에 없는 core 값을 import하는 클라이언트 파일이 없다',
        () => {
            const violations = findServerOnlyCoreImports(
                repoClientGraph(),
                loadClientExports()
            );
            expect(
                violations.map(v => `${v.file}:${v.line} ${v.symbol}`),
                '클라이언트 번들이 브라우저 진입점에 없는 core 값을 import한다 — 서버 전용 모듈로 옮기거나 core에 브라우저 진입점 내보내기를 추가해야 한다'
            ).toEqual([]);
        },
        SCAN_TIMEOUT_MS
    );

    it('브라우저 진입점 내보내기를 실제로 읽는다(비어 있지 않고 서버 전용 심볼은 없다)', () => {
        const exports = loadClientExports();
        expect(exports.size).toBeGreaterThan(50);
        expect(exports.has('calculateIndicators')).toBe(true);
        expect(exports.has('runAnalysis')).toBe(false);
    });
});

describe('parseClientExports', () => {
    it('값이 붙는 `exports.X =`와 defineProperty만 세고 `= void 0` 선언과 __esModule은 뺀다', () => {
        const source = [
            'Object.defineProperty(exports, "__esModule", { value: true });',
            'exports.a = exports.b = void 0;',
            'Object.defineProperty(exports, "c", { enumerable: true, get: function () { return x.c; } });',
        ].join('\n');
        expect([...parseClientExports(source)].sort()).toEqual(['c']);
        expect(
            [
                ...parseClientExports(
                    `${source}\nexports.a = 1;\nexports.d = exports.e = f;`
                ),
            ].sort()
        ).toEqual(['a', 'c', 'd', 'e']);
    });
});

describe('검출기 픽스처', () => {
    const exportsSet = new Set(['calculateIndicators']);
    let dir: string;
    const write = (name: string, source: string): string => {
        const file = path.join(dir, name);
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, source);
        return file;
    };
    const scan = (...roots: string[]): string[] =>
        findServerOnlyCoreImports(clientGraphFiles(roots), exportsSet).map(
            v => `${v.file.split('/').pop()}:${v.line} ${v.symbol}`
        );

    beforeAll(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'core-client-exports-'));
        // 해석기가 디렉터리 목록을 캐시하므로 첫 해석 전에 하위 디렉터리를 모두 만들어 둔다.
        for (const sub of [
            'direct',
            'alias',
            'types',
            'transitive',
            'reexport',
            'lazy',
            'typeedge',
            'opaque',
            'action',
            'boundary',
            'lookalike',
        ])
            mkdirSync(path.join(dir, sub));
    });
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it('클라이언트 파일의 서버 전용 심볼 import를 파일·줄·심볼로 잡는다', () => {
        const file = write(
            'direct/Direct.tsx',
            "'use client';\nimport { calculateIndicators, runAnalysis } from '@y0ngha/siglens-core';\n"
        );
        expect(scan(file)).toEqual(['Direct.tsx:2 runAnalysis']);
    });

    it('별칭으로 가져와도 원래 이름으로 잡는다', () => {
        const file = write(
            'alias/Alias.tsx',
            "'use client';\nimport { runAnalysis as go } from '@y0ngha/siglens-core';\n"
        );
        expect(scan(file)).toEqual(['Alias.tsx:2 runAnalysis']);
    });

    it('타입 전용 import는 통과한다(import type·인라인 type 지정자)', () => {
        const file = write(
            'types/Types.tsx',
            "'use client';\nimport type { Foo } from '@y0ngha/siglens-core';\nimport { type Bar, calculateIndicators } from '@y0ngha/siglens-core';\n"
        );
        expect(scan(file)).toEqual([]);
    });

    it('클라이언트 파일이 import한 일반 모듈의 위반도 잡는다(전이)', () => {
        write(
            'transitive/helper.ts',
            "import { runAnalysis } from '@y0ngha/siglens-core';\nexport const h = runAnalysis;\n"
        );
        const client = write(
            'transitive/Client.tsx',
            "'use client';\nimport { h } from './helper';\nexport const c = h;\n"
        );
        expect(scan(client)).toEqual(['helper.ts:1 runAnalysis']);
    });

    it('`import type`으로만 닿는 모듈은 번들에 없으므로 통과한다', () => {
        write(
            'typeedge/serverSide.ts',
            "import { runAnalysis } from '@y0ngha/siglens-core';\nexport type T = typeof runAnalysis;\nexport const s = runAnalysis;\n"
        );
        const client = write(
            'typeedge/Client.tsx',
            "'use client';\nimport type { T } from './serverSide';\nimport { type T as U } from './serverSide';\nexport type X = T | U;\n"
        );
        expect(scan(client)).toEqual([]);
    });

    it('`export … from` 재노출도 따라간다', () => {
        write(
            'reexport/leaf.ts',
            "import { runAnalysis } from '@y0ngha/siglens-core';\nexport const l = runAnalysis;\n"
        );
        write('reexport/mid.ts', "export { l } from './leaf';\n");
        const client = write(
            'reexport/Client.tsx',
            "'use client';\nimport { l } from './mid';\nexport const c = l;\n"
        );
        expect(scan(client)).toEqual(['leaf.ts:1 runAnalysis']);
    });

    it('동적 import() 뒤의 모듈도 클라이언트 그래프다', () => {
        write(
            'lazy/Lazy.tsx',
            "import { runAnalysis } from '@y0ngha/siglens-core';\nexport default runAnalysis;\n"
        );
        const client = write(
            'lazy/Client.tsx',
            "'use client';\nexport const load = () => import('./Lazy');\n"
        );
        expect(scan(client)).toEqual(['Lazy.tsx:1 runAnalysis']);
    });

    it('이름공간 import·export *·import()는 검사할 수 없으므로 `*`로 잡는다', () => {
        const ns = write(
            'opaque/Ns.tsx',
            "'use client';\nimport * as core from '@y0ngha/siglens-core';\nexport const n = core;\n"
        );
        const all = write(
            'opaque/All.tsx',
            "'use client';\nexport * from '@y0ngha/siglens-core';\n"
        );
        const dyn = write(
            'opaque/Dyn.tsx',
            "'use client';\nexport const d = () => import('@y0ngha/siglens-core');\n"
        );
        expect(scan(ns)).toEqual(['Ns.tsx:2 *']);
        expect(scan(all)).toEqual(['All.tsx:2 *']);
        expect(scan(dyn)).toEqual(['Dyn.tsx:2 *']);
    });

    it("'use server' 액션 파일은 클라이언트가 import해도 서버에서 실행되므로 통과한다", () => {
        write(
            'action/action.ts',
            "'use server';\nimport { runAnalysis } from '@y0ngha/siglens-core';\nexport async function go() { return runAnalysis; }\n"
        );
        const client = write(
            'action/Client.tsx',
            "'use client';\nimport { go } from './action';\nexport const c = go;\n"
        );
        expect(scan(client)).toEqual([]);
    });

    it("`import 'server-only'` 모듈은 서버 경계라 걷지 않는다", () => {
        write(
            'boundary/serverOnly.ts',
            "import 'server-only';\nimport { runAnalysis } from '@y0ngha/siglens-core';\nexport const s = runAnalysis;\n"
        );
        const client = write(
            'boundary/Client.tsx',
            "'use client';\nimport { s } from './serverOnly';\nexport const c = s;\n"
        );
        expect(scan(client)).toEqual([]);
    });

    it("닮은 형태: 'use client'가 아닌 서버 컴포넌트는 시작점이 아니라 통과한다", () => {
        const server = write(
            'lookalike/Server.tsx',
            "import { runAnalysis } from '@y0ngha/siglens-core';\nexport const S = runAnalysis;\n"
        );
        const client = write(
            'lookalike/Client.tsx',
            "'use client';\nimport { calculateIndicators } from '@y0ngha/siglens-core';\nexport const C = calculateIndicators;\n"
        );
        expect(useClientRoots([server, client])).toEqual([client]);
        expect(scan(...useClientRoots([server, client]))).toEqual([]);
    });

    it('서버 경계 경로(app/api, entities/<x>/api.ts)는 걷지 않는다', () => {
        expect(isServerPath('app/api/v1/route.ts')).toBe(true);
        expect(isServerPath('entities/bars/api.ts')).toBe(true);
        expect(isServerPath('entities/bars/lib/api.ts')).toBe(false);
        expect(isServerPath('app/[locale]/page.tsx')).toBe(false);
    });

    it('core가 아닌 패키지의 같은 이름은 잡지 않는다', () => {
        const file = write(
            'lookalike/Other.tsx',
            "'use client';\nimport { runAnalysis } from 'some-other-package';\n"
        );
        expect(scan(file)).toEqual([]);
    });
});
