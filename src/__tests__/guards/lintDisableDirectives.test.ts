import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **lint 억제 주석 금지 가드** (CONVENTIONS.md "Lint and guard rules").
 *
 * `eslint-disable` / `oxlint-disable` 주석은 규칙이 알리는 문제를 덮을 뿐 고치지 않는다.
 * 이 문서에만 있던 금지를 기계로 옮겼다. 정당한 예외는 아래 허용 목록 두 곳이고, 둘 다
 * `--` 뒤에 사유를 적어야 한다. 목록을 늘리려면 이 가드를 고치는 PR에서 사유를 설명한다.
 *
 * 스캔 범위는 코드 루트(`src`·`e2e`·`scripts`·`cache-handler`·`db`·`infra`)와 레포 루트의
 * 설정·코드 파일이다. `.claude`·`.codex` 에이전트 훅과 문서(`docs`)는 범위 밖이다.
 * `react-doctor-disable-next-line`(TC-6)은 다른 도구의 주석이라 걸리지 않는다.
 */

const ROOT = path.resolve(__dirname, '../../..');
const SCAN_ROOTS = ['src', 'e2e', 'scripts', 'cache-handler', 'db', 'infra'];
const CODE_FILE = /\.(?:ts|tsx|mts|mjs|cjs|js)$/;

/** 사유를 달아 허용하는 파일. 개수를 고정한다(아래 테스트). */
const ALLOWED_WITH_REASON: readonly string[] = [
    'src/app/global-error.tsx',
    'src/app/not-found.tsx',
];

const DIRECTIVE = new RegExp(
    String.raw`(?://|/\*)\s*(?:eslint|oxlint)-` + `disable[^\\n]*`,
    'g'
);

interface ScannedFile {
    readonly path: string;
    readonly text: string;
}

function findDisableViolations(files: readonly ScannedFile[]): string[] {
    return files.flatMap(file =>
        [...file.text.matchAll(DIRECTIVE)].flatMap(match => {
            if (!ALLOWED_WITH_REASON.includes(file.path)) {
                return [`${file.path}: lint disable directive: ${match[0]}`];
            }
            return match[0].includes('--')
                ? []
                : [`${file.path}: allowed directive has no "--" reason`];
        })
    );
}

function trackedCodeFiles(): ScannedFile[] {
    const listed = execFileSync(
        'git',
        ['ls-files', '--cached', '--others', '--exclude-standard'],
        { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
    )
        .split('\n')
        .filter(Boolean);
    return listed
        .filter(file => CODE_FILE.test(file))
        .filter(file => {
            const top = file.split('/')[0] ?? '';
            return !file.includes('/') || SCAN_ROOTS.includes(top);
        })
        .map(file => ({
            path: file,
            text: readFileSync(path.join(ROOT, file), 'utf8'),
        }));
}

// 가드가 쓰는 디렉티브 문구는 이 파일이 스스로 걸리지 않게 조각내 만든다.
const MARK = 'eslint-' + 'disable';
const OXMARK = 'oxlint-' + 'disable';

describe('lint disable directives', () => {
    it('레포의 코드에는 허용 목록 밖의 억제 주석이 없다', () => {
        expect(findDisableViolations(trackedCodeFiles())).toEqual([]);
    });

    it('허용 목록은 두 파일이고, 둘 다 실제로 사유 있는 지시어를 갖는다', () => {
        expect(ALLOWED_WITH_REASON).toHaveLength(2);
        const files = trackedCodeFiles();
        ALLOWED_WITH_REASON.forEach(allowed => {
            const file = files.find(f => f.path === allowed);
            expect(file, `${allowed} must exist`).toBeDefined();
            // `g` 정규식을 toMatch에 넘기면 lastIndex 상태가 남으므로 String#match로 읽는다.
            expect(file?.text.match(DIRECTIVE)).not.toBeNull();
        });
    });

    describe('planted violations', () => {
        const plant = (p: string, text: string): ScannedFile => ({
            path: p,
            text,
        });

        it('줄 주석 형태를 잡는다', () => {
            expect(
                findDisableViolations([
                    plant('src/x.ts', `// ${MARK}-next-line no-console\n`),
                ])
            ).toHaveLength(1);
        });

        it('줄 끝 형태와 블록 형태, oxlint 이름도 잡는다', () => {
            expect(
                findDisableViolations([
                    plant('src/x.ts', `const a = 1; // ${MARK}-line foo\n`),
                    plant('src/y.ts', `/* ${OXMARK} foo */\n`),
                    plant('src/z.ts', `// ${OXMARK}-next-line foo\n`),
                ])
            ).toHaveLength(3);
        });

        it('사유(--)가 있어도 허용 목록 밖이면 잡는다', () => {
            expect(
                findDisableViolations([
                    plant('src/x.ts', `// ${MARK}-next-line foo -- 사유\n`),
                ])
            ).toHaveLength(1);
        });

        it('허용 목록 안이어도 사유(--)가 없으면 잡는다', () => {
            expect(
                findDisableViolations([
                    plant('src/app/global-error.tsx', `/* ${MARK} foo */\n`),
                ])
            ).toEqual([
                'src/app/global-error.tsx: allowed directive has no "--" reason',
            ]);
        });

        it('허용 목록 안에서 사유가 있으면 통과한다', () => {
            expect(
                findDisableViolations([
                    plant(
                        'src/app/not-found.tsx',
                        `/* ${MARK} foo -- 사유\n * 설명 */\n`
                    ),
                ])
            ).toEqual([]);
        });

        it('다른 도구의 억제 주석과 일반 문장은 잡지 않는다', () => {
            expect(
                findDisableViolations([
                    plant(
                        'src/x.ts',
                        '// react-doctor-disable-next-line foo\n// how to disable lint is documented elsewhere\n'
                    ),
                ])
            ).toEqual([]);
        });
    });
});
