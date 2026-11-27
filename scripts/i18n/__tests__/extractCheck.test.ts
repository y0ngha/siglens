import { spawnSync } from 'node:child_process';
import {
    cpSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
    symlinkSync,
    unlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '../../..');
const OUTPUTS = [
    'messages/ko.json',
    'messages/_meta/skips.json',
    'messages/_meta/clientKeys.json',
] as const;

/**
 * `extract.mjs`는 `ROOT`를 `process.argv[1]`(스크립트 경로)에서 `../../..`로 구한다.
 * 그래서 스크립트(`scripts/i18n`)를 임시 트리로 복사해 그 사본을 실행하면 임시 트리가
 * 곧 ROOT가 된다. 파서 패키지는 `scan.mjs`가 `createRequire`로 찾으므로 레포의
 * `node_modules`를 심볼릭 링크로 연결한다. 레포 트리는 한 글자도 읽거나 쓰지 않는다.
 */
function makeTree(): string {
    const root = mkdtempSync(join(tmpdir(), 'extract-check-'));
    mkdirSync(join(root, 'scripts'), { recursive: true });
    cpSync(join(REPO_ROOT, 'scripts/i18n'), join(root, 'scripts/i18n'), {
        recursive: true,
        filter: source => !source.includes('__tests__'),
    });
    symlinkSync(join(REPO_ROOT, 'node_modules'), join(root, 'node_modules'));
    mkdirSync(join(root, 'src/entities/demo/ui'), { recursive: true });
    writeFileSync(
        join(root, 'src/entities/demo/ui/Demo.tsx'),
        [
            'export function Demo() {',
            "    console.error('[demo] 데이터를 불러오지 못했다');",
            "    return <p>{'안녕하세요'}</p>;",
            '}',
            '',
        ].join('\n')
    );
    return root;
}

function run(root: string, ...flags: string[]) {
    return spawnSync(
        process.execPath,
        [join(root, 'scripts/i18n/extract.mjs'), ...flags],
        { encoding: 'utf8' }
    );
}

/** `node_modules` 링크를 뺀 모든 파일의 내용과 mtime. */
function snapshot(root: string): Record<string, string> {
    return Object.fromEntries(
        readdirSync(root, { recursive: true, encoding: 'utf8' })
            .filter(rel => !rel.startsWith('node_modules'))
            .filter(rel => statSync(join(root, rel)).isFile())
            .sort()
            .map(rel => [
                rel,
                `${statSync(join(root, rel)).mtimeMs}:${readFileSync(join(root, rel), 'utf8')}`,
            ])
    );
}

const trees: string[] = [];

/** 새 트리를 만들고 `--write`로 산출물을 채운다. */
function writtenTree(): string {
    const root = makeTree();
    trees.push(root);
    expect(run(root, '--write').status).toBe(0);
    return root;
}

// 테스트마다 node를 두 번(--write, --check) 띄워 로컬에서도 1초 안팎이 걸린다. 비용이 정해져 있으니
// 기본 5초 제한 대신 넉넉한 제한을 명시해 부하 걸린 CI 샤드에서 시간 초과로 깨지지 않게 한다.
const SPAWN_TEST_TIMEOUT_MS = 30_000;

describe(
    'extract.mjs --check (임시 트리에서 실제 실행)',
    { timeout: SPAWN_TEST_TIMEOUT_MS },
    () => {
        beforeAll(() => {
            // 아래 모든 테스트가 같은 가정을 쓴다: --write가 세 산출물을 모두 만든다.
            const root = writtenTree();
            OUTPUTS.forEach(rel => {
                expect(statSync(join(root, rel)).isFile()).toBe(true);
            });
        }, SPAWN_TEST_TIMEOUT_MS);

        afterAll(() => {
            trees.forEach(root =>
                rmSync(root, { recursive: true, force: true })
            );
        });

        it('산출물이 최신이면 exit 0이고 아무것도 쓰지 않는다', () => {
            const root = writtenTree();
            const before = snapshot(root);

            const result = run(root, '--check');

            expect(result.status).toBe(0);
            expect(snapshot(root)).toEqual(before);
        });

        it.each(OUTPUTS)('%s가 어긋나면 exit 1로 그 파일을 알린다', rel => {
            const root = writtenTree();
            writeFileSync(join(root, rel), '{"drift": true}\n');
            const before = snapshot(root);

            const result = run(root, '--check');

            expect(result.status).toBe(1);
            expect(result.stderr).toContain(rel);
            expect(result.stderr).toContain('yarn i18n:extract --write');
            // 어긋난 파일도 검사가 고치지 않는다.
            expect(snapshot(root)).toEqual(before);
        });

        it.each(OUTPUTS)('%s가 없으면 exit 1이다', rel => {
            const root = writtenTree();
            unlinkSync(join(root, rel));

            const result = run(root, '--check');

            expect(result.status).toBe(1);
            expect(result.stderr).toContain(rel);
        });

        it('소스를 고쳐 줄 번호가 밀리면 skips.json 드리프트로 잡는다', () => {
            const root = writtenTree();
            const file = join(root, 'src/entities/demo/ui/Demo.tsx');
            writeFileSync(file, `\n\n${readFileSync(file, 'utf8')}`);

            const result = run(root, '--check');

            expect(result.status).toBe(1);
            expect(result.stderr).toContain('messages/_meta/skips.json');
        });

        it.each([['--write'], ['--apply'], ['--only', 'src']])(
            '--check는 %s와 함께 쓸 수 없다(exit 2)',
            (...flags) => {
                const root = writtenTree();
                const before = snapshot(root);

                const result = run(root, '--check', ...flags);

                expect(result.status).toBe(2);
                expect(snapshot(root)).toEqual(before);
            }
        );
    }
);
