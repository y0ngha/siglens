import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { fileImports, resolveImportPath, SRC } from './support/importGraph';

/**
 * 가드 셋(순환·core 클라이언트 번들·서버 전용 모듈)이 공유하는 해석 규칙. 실제 트리에
 * 해당 형태가 없어도 규칙이 깨지면 여기서 드러나게, 임시 디렉터리 픽스처로 고정한다.
 */
let dir: string;
const at = (...segments: string[]): string => path.join(dir, ...segments);
const write = (name: string, source = 'export const x = 1;\n'): string => {
    const file = at(name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, source);
    return file;
};

beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'import-graph-'));
    write('Foo.ts');
    write('util/index.ts');
    write('widget.tsx');
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('resolveImportPath', () => {
    const from = (): string => at('entry.ts');

    it('`@/` alias를 src 아래 파일로 푼다', () => {
        expect(
            resolveImportPath('@/__tests__/guards/support/importGraph', from())
        ).toBe(path.join(SRC, '__tests__/guards/support/importGraph.ts'));
    });

    it('확장자 없는 상대경로를 .ts·.tsx 파일로 푼다', () => {
        expect(resolveImportPath('./Foo', from())).toBe(at('Foo.ts'));
        expect(resolveImportPath('./widget', from())).toBe(at('widget.tsx'));
    });

    it('디렉터리 import를 index 파일로 푼다', () => {
        expect(resolveImportPath('./util', from())).toBe(at('util/index.ts'));
    });

    it('ESM식 .js 표기와 쿼리 접미사를 벗긴다', () => {
        expect(resolveImportPath('./Foo.js', from())).toBe(at('Foo.ts'));
        expect(resolveImportPath('./Foo?raw', from())).toBe(at('Foo.ts'));
    });

    it('대소문자가 틀린 경로는 해석 실패다(대소문자를 가리지 않는 파일시스템에서도)', () => {
        expect(resolveImportPath('./foo', from())).toBeNull();
    });

    it('없는 내부 경로는 null이다', () => {
        expect(resolveImportPath('./missing', from())).toBeNull();
    });

    it('외부 패키지와 비코드 자원은 undefined다', () => {
        expect(resolveImportPath('react', from())).toBeUndefined();
        expect(resolveImportPath('./styles.css', from())).toBeUndefined();
    });
});

describe('fileImports', () => {
    it.each([
        ["'use client';\n", 'use client'],
        ["/** 설명 */\n'use client';\n", 'use client'],
        ["'use server';\n", 'use server'],
        ['export const x = 1;\n', null],
    ])('지시문을 읽는다 (%j)', (source, expected) => {
        const file = write(
            `directive-${String(expected)}-${source.length}.ts`,
            source
        );
        expect(fileImports(file).directive).toBe(expected);
    });

    it('import마다 해석 결과를 붙인다', () => {
        const file = write(
            'importer.ts',
            "import { x } from './Foo';\nimport React from 'react';\nimport { y } from './missing';\n"
        );
        expect(
            fileImports(file).imports.map(({ specifier, resolved }) => [
                specifier,
                resolved,
            ])
        ).toEqual([
            ['./Foo', at('Foo.ts')],
            ['react', undefined],
            ['./missing', null],
        ]);
    });

    it('동기 require는 평가는 늦지만 같은 청크에 실린다', () => {
        const file = write(
            'requirer.ts',
            "const load = () => require('./Foo');\n"
        );
        expect(fileImports(file).imports).toMatchObject([
            { specifier: './Foo', dynamic: true, lazyChunk: false },
        ]);
    });

    it('import()는 별도 청크다', () => {
        const file = write('lazy.ts', "const load = () => import('./Foo');\n");
        expect(fileImports(file).imports).toMatchObject([
            { specifier: './Foo', dynamic: true, lazyChunk: true },
        ]);
    });
});
