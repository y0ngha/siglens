import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sourceFiles } from '@/__tests__/guards/support/controlUsage';
import { fileImports, SRC } from '@/__tests__/guards/support/importGraph';

/**
 * **`'use client'` 파일의 import 그래프에 서버 전용 모듈이 들어가지 않는다.**
 *
 * 클라이언트 컴포넌트가 `verifyEmail → tokenUtils → node:crypto`처럼 서버 전용
 * 모듈로 이어지는 파일에서 상수 하나만 가져와도 Turbopack이 전체 그래프를
 * 클라이언트 번들에 넣으려 하고 **빌드가 깨진다**.
 *
 * 실제로 그렇게 냈다: `LoginForm`이 에러 코드 표를 당시의 `@/entities/auth`
 * barrel에서 가져오자 `yarn build`가 `Ecmascript file had an error`로 죽었다.
 * tsc·lint·11,000개 테스트는 전부 통과했다 — 번들러만 아는 결함이라 빌드까지
 * 가야 보인다. v0.58.0의 "서버 SDK가 클라 번들로 새던 barrel 누출"과 같은
 * 결함군이다. barrel은 이제 금지(`src/__tests__/guards/noBarrelFiles.test.ts`)지만
 * 직접 import로도 같은 그래프는 만들어질 수 있다.
 *
 * 이 가드는 그걸 **빌드 전에** 잡는다. 빌드는 4분, 이 테스트는 1초다.
 *
 * import 추출·해석·지시문 판정은 순환 가드와 같은 `importGraph.ts`를 쓴다(파서 기반이라
 * 주석 속 경로나 `import type`을 의존으로 세지 않는다). 정적 import·재노출·side-effect
 * import·동적 `import()`를 모두 따라간다 — 동적 청크도 클라이언트 번들에 들어간다.
 */

/** Node 전용 API 모듈. 하위 경로(`fs/promises`)도 같다. */
const SERVER_ONLY_MODULE =
    /^(?:node:)?(?:crypto|fs|path|net|dns|child_process)(?:\/|$)/;

/** `file`(절대 경로)이 서버 전용인가 — `server-only` 표지나 Node 전용 모듈의 값 import. */
const isServerOnly = (file: string): boolean =>
    fileImports(file).imports.some(
        ({ specifier, typeOnly }) =>
            !typeOnly &&
            (specifier === 'server-only' || SERVER_ONLY_MODULE.test(specifier))
    );

/** `entry`에서 도달 가능한 서버 전용 모듈의 첫 경로(`src/` 기준). 없으면 `null`. */
function serverOnlyPath(entry: string): string[] | null {
    const seen = new Set<string>();
    const stack: Array<[string, string[]]> = [[entry, [entry]]];
    while (stack.length > 0) {
        const [current, trail] = stack.pop()!;
        if (seen.has(current)) continue;
        seen.add(current);
        const { directive, imports } = fileImports(current);
        if (trail.length > 1) {
            /**
             * `'use server'`는 **번들 경계**다 — 그 아래 그래프는 클라이언트로
             * 넘어가지 않고 RPC 스텁만 남는다. 여기서 멈추지 않으면 서버 액션을
             * 부르는 모든 클라이언트 컴포넌트가 오탐으로 잡힌다.
             */
            if (directive === 'use server') continue;
            /**
             * `import 'server-only'`는 경계가 **아니라 표지**다 — 클라이언트
             * 그래프에 들어가면 빌드가 깨진다. 그래서 여기 도달했다는 것 자체가
             * 위반이다.
             *
             * (처음엔 이걸 경계로 오해해 `continue`했고, 그 탓에 실제 결함을
             * 재현한 변이가 통과했다.)
             */
            if (isServerOnly(current))
                return trail.map(file => path.relative(SRC, file));
        }
        for (const { resolved, typeOnly } of imports)
            if (!typeOnly && typeof resolved === 'string')
                stack.push([resolved, [...trail, resolved]]);
    }
    return null;
}

describe("'use client' 파일은 서버 전용 모듈을 끌고 오지 않는다", () => {
    it('위반이 없다', () => {
        const clientFiles = sourceFiles(SRC)
            .filter(file => !file.includes(`${path.sep}__tests__${path.sep}`))
            .filter(file => fileImports(file).directive === 'use client');
        // 스캔이 헛돌지 않는지 — 클라이언트 파일이 0건이면 이 가드가 무의미하다.
        expect(clientFiles.length).toBeGreaterThan(20);

        const offenders = clientFiles.flatMap(file => {
            const trail = serverOnlyPath(file);
            return trail === null ? [] : [trail.join(' → ')];
        });

        expect(offenders).toEqual([]);
    });

    describe('검출기', () => {
        let dir: string;
        const write = (name: string, source: string): string => {
            const file = path.join(dir, name);
            writeFileSync(file, source);
            return file;
        };

        beforeAll(() => {
            dir = mkdtempSync(path.join(tmpdir(), 'server-only-guard-'));
            write(
                'crypto.ts',
                "import { randomUUID } from 'node:crypto';\nexport const id = randomUUID;\n"
            );
            write(
                'marker.ts',
                "import 'server-only';\nexport const secret = 1;\n"
            );
            write(
                'types.ts',
                "import type { Hash } from 'node:crypto';\nexport type H = Hash;\n"
            );
            write(
                'action.ts',
                "'use server';\nimport { id } from './crypto';\nexport async function run() { return id(); }\n"
            );
        });
        afterAll(() => rmSync(dir, { recursive: true, force: true }));

        it.each([
            [
                'Node 전용 모듈을 값으로 import하는 파일',
                'StaticCrypto.tsx',
                "import { id } from './crypto';",
            ],
            [
                "'server-only' 표지가 있는 파일",
                'Marker.tsx',
                "import { secret } from './marker';",
            ],
            [
                '동적 import로 닿는 서버 전용 파일',
                'DynamicCrypto.tsx',
                "export const load = () => import('./crypto');",
            ],
        ])('%s 까지의 경로를 잡는다', (_label, name, line) => {
            const entry = write(name, `'use client';\n${line}\n`);
            expect(serverOnlyPath(entry)).not.toBeNull();
        });

        it('타입만 가져오는 경로는 넘어간다', () => {
            const entry = write(
                'TypeOnly.tsx',
                "'use client';\nimport type { H } from './types';\n"
            );
            expect(serverOnlyPath(entry)).toBeNull();
        });

        it("'use server' 파일에서 멈춘다", () => {
            const entry = write(
                'CallsAction.tsx',
                "'use client';\nimport { run } from './action';\n"
            );
            expect(serverOnlyPath(entry)).toBeNull();
        });
    });
});
