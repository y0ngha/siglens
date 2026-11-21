import { spawnSync } from 'node:child_process';
import {
    copyFileSync,
    mkdirSync,
    mkdtempSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS } from './support/controlUsage';

/**
 * **lint 규칙이 실제로 켜져 있는지 확인하는 가드.**
 *
 * `.oxlintrc.json`에서 규칙 한 줄이 지워지거나 override 순서가 바뀌어도 `yarn lint`는
 * 그냥 초록이다. 그래서 일부러 규칙을 어긴 파일을 임시 폴더에 만들고, 레포의 실제
 * `.oxlintrc.json`을 그 폴더로 복사해 oxlint를 돌려 진단이 나오는지 본다.
 * 설정 파일 안의 glob은 설정 파일 위치 기준이라 임시 폴더에 같은 구조(`src/**`,
 * `cache-handler/__tests__/**`)로 두어야 override가 같은 방식으로 걸린다.
 * `--no-ignore`는 쓰지 않는다. 임시 폴더는 레포의 ignorePatterns와 겹치지 않는다.
 */

const ROOT = path.resolve(__dirname, '../../..');
const OXLINT = path.join(ROOT, 'node_modules/.bin/oxlint');

interface Diagnostic {
    readonly code: string;
    readonly filename: string;
}

const PROD = 'src/shared/lib';
const TEST = 'src/shared/lib/__tests__';
const CACHE_TEST = 'cache-handler/__tests__';
const SCRIPTS_TEST = 'scripts/lib/__tests__';
const E2E_SPEC = 'e2e';
const E2E_SUPPORT = 'e2e/support';

const FILES: Readonly<Record<string, string>> = {
    [`${PROD}/dep.ts`]: 'export const a = 1;\nexport const b = 2;\n',
    [`${PROD}/preferConst.ts`]:
        'let neverReassigned = 1;\nexport const value = neverReassigned;\n',
    [`${PROD}/duplicateImports.ts`]:
        "import { a } from './dep';\nimport { b } from './dep';\nexport const sum = a + b;\n",
    [`${PROD}/importFirst.ts`]:
        "export const early = 1;\nimport { a } from './dep';\nexport const late = a + early;\n",
    [`${PROD}/explicitAny.ts`]: 'export const loose: any = 1;\n',
    // 테스트 경로: import/first는 꺼져 있다(vi.mock을 import 위에 두는 TE-1 형태).
    // prefer-const는 켜져 있어야 린터가 이 파일을 실제로 읽었다는 증거가 된다.
    [`${TEST}/mockAboveImports.ts`]:
        "export const early = 1;\nimport { a } from '../dep';\nlet neverReassigned = a + early;\nexport const value = neverReassigned;\n",
    [`${SCRIPTS_TEST}/mockAboveImports.test.ts`]:
        "export const early = 1;\nimport { a } from '../../../src/shared/lib/dep';\nlet neverReassigned = a + early;\nexport const value = neverReassigned;\n",
    [`${E2E_SPEC}/mockAboveImports.spec.ts`]:
        "export const early = 1;\nimport { a } from '../src/shared/lib/dep';\nlet neverReassigned = a + early;\nexport const value = neverReassigned;\n",
    // e2e 지원 코드는 테스트 파일이 아니라 import/first가 계속 적용된다.
    [`${E2E_SUPPORT}/importFirst.ts`]:
        "export const early = 1;\nimport { a } from '../../src/shared/lib/dep';\nexport const late = a + early;\n",
    [`${CACHE_TEST}/mockAboveImports.test.mjs`]:
        "export const early = 1;\nimport { a } from '../../src/shared/lib/dep';\nlet neverReassigned = a + early;\nexport const value = neverReassigned;\n",
};

let workDir = '';

function diagnosticsOf(): Diagnostic[] {
    const result = spawnSync(
        OXLINT,
        ['-c', '.oxlintrc.json', '-f', 'json', '.'],
        { cwd: workDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    );
    const parsed: unknown = JSON.parse(result.stdout);
    if (
        typeof parsed !== 'object' ||
        parsed === null ||
        !('diagnostics' in parsed) ||
        !Array.isArray(parsed.diagnostics)
    ) {
        throw new Error(`unexpected oxlint output: ${result.stdout}`);
    }
    return parsed.diagnostics.map((d: Diagnostic) => ({
        code: d.code,
        filename: d.filename,
    }));
}

function codesFor(diagnostics: readonly Diagnostic[], file: string): string[] {
    return diagnostics
        .filter(d => d.filename === file)
        .map(d => d.code)
        .sort();
}

beforeAll(() => {
    workDir = mkdtempSync(path.join(tmpdir(), 'lint-rules-enabled-'));
    copyFileSync(
        path.join(ROOT, '.oxlintrc.json'),
        path.join(workDir, '.oxlintrc.json')
    );
    Object.entries(FILES).forEach(([file, text]) => {
        mkdirSync(path.dirname(path.join(workDir, file)), { recursive: true });
        writeFileSync(path.join(workDir, file), text);
    });
});

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe('.oxlintrc.json keeps the mechanized rules on', () => {
    it(
        '운영 코드에서는 네 규칙이 모두 보고된다',
        () => {
            const diagnostics = diagnosticsOf();
            expect(codesFor(diagnostics, `${PROD}/preferConst.ts`)).toContain(
                'eslint(prefer-const)'
            );
            expect(
                codesFor(diagnostics, `${PROD}/duplicateImports.ts`)
            ).toContain('import(no-duplicates)');
            expect(codesFor(diagnostics, `${PROD}/importFirst.ts`)).toContain(
                'import(first)'
            );
            expect(codesFor(diagnostics, `${PROD}/explicitAny.ts`)).toContain(
                'typescript(no-explicit-any)'
            );
            expect(
                codesFor(diagnostics, `${E2E_SUPPORT}/importFirst.ts`)
            ).toContain('import(first)');
        },
        SCAN_TIMEOUT_MS
    );

    it(
        '테스트 경로에서는 import/first만 꺼지고 나머지 규칙은 계속 켜져 있다',
        () => {
            const diagnostics = diagnosticsOf();
            [
                `${TEST}/mockAboveImports.ts`,
                `${CACHE_TEST}/mockAboveImports.test.mjs`,
                `${SCRIPTS_TEST}/mockAboveImports.test.ts`,
                `${E2E_SPEC}/mockAboveImports.spec.ts`,
            ].forEach(file => {
                const codes = codesFor(diagnostics, file);
                expect(codes).toContain('eslint(prefer-const)');
                expect(codes).not.toContain('import(first)');
            });
        },
        SCAN_TIMEOUT_MS
    );
});
