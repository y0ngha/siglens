import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **barrel(`index.ts`/`index.tsx`) 금지 가드.**
 *
 * 이 레포는 barrel을 쓰지 않는다 — 모든 import는 심볼을 정의한 파일을 직접
 * 가리킨다(테스트·`vi.mock` 경로 포함). barrel은 re-export가 쌓이기만 하고
 * 빠지지 않아, 결국 client 번들에 server-only 모듈을 끌고 오는 누출 경로가 되고
 * (v0.58.0) 걷어내기도 어려워진다. 한 번 전부 걷어냈으므로 새로 생기는 것을
 * 여기서 막는다.
 *
 * 파일명이 `index`인 모듈 자체를 금지한다. 실제 코드를 담은 `index.ts`도
 * `'<dir>'` 형태의 디렉터리 import를 허용해 barrel과 구분되지 않으므로,
 * 내용이 무엇이든 주 export에 맞는 이름을 붙인다.
 */
const SRC_DIR = path.resolve(__dirname, '../..');

describe('src/ 아래에 barrel(index.ts/index.tsx)이 없다', () => {
    it('index.ts / index.tsx 파일이 0개다', () => {
        const offenders = readdirSync(SRC_DIR, {
            recursive: true,
            encoding: 'utf8',
        })
            .filter(rel => /(^|[\\/])index\.tsx?$/.test(rel))
            .map(rel => `src/${rel.split(path.sep).join('/')}`)
            .sort();

        expect(offenders).toEqual([]);
    });
});

/**
 * 이름이 `index`가 아니어도 re-export만 담은 파일(`actions.ts` 등)은 같은 barrel이다.
 *
 * `runAnalysisBridge.ts`는 예외다 — core `runAnalysis` 하나를 라우트 테스트가
 * 따로 mock할 수 있게 둔 seam이라, 없애면 `@y0ngha/siglens-core` 전체를 mock해야 한다.
 */
const REEXPORT_SEAMS = new Set([
    'src/app/api/analysis/stream/runAnalysisBridge.ts',
]);

function stripComments(source: string): string {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function isReExportOnly(source: string): boolean {
    const statements = stripComments(source)
        .split(';')
        .map(s => s.trim())
        .filter(Boolean);
    return (
        statements.length > 0 &&
        statements.every(
            s =>
                /^['"]use (server|client)['"]$/.test(s) ||
                /^export\s+(type\s+)?(\{[\s\S]*\}|\*(\s+as\s+\w+)?)\s+from\s+['"][^'"]+['"]$/.test(
                    s
                )
        )
    );
}

describe('src/ 아래에 re-export 전용 파일이 없다', () => {
    it('모든 모듈은 자기 선언을 하나 이상 갖는다', () => {
        const offenders = readdirSync(SRC_DIR, {
            recursive: true,
            encoding: 'utf8',
        })
            .filter(
                rel =>
                    /\.tsx?$/.test(rel) &&
                    !/(^|[\\/])__tests__[\\/]/.test(rel) &&
                    !rel.endsWith('.d.ts')
            )
            .map(rel => `src/${rel.split(path.sep).join('/')}`)
            .filter(rel => !REEXPORT_SEAMS.has(rel))
            .filter(rel =>
                isReExportOnly(
                    readFileSync(path.resolve(SRC_DIR, '..', rel), 'utf8')
                )
            )
            .sort();

        expect(offenders).toEqual([]);
    });
});
