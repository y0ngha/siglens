import {
    lstatSync,
    mkdirSync,
    mkdtempSync,
    realpathSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * **SCOPE.md 단일 정본 가드.**
 *
 * 분석 경계 문서의 정본은 `siglens-core/docs/SCOPE.md` 한 벌이다. siglens의
 * architecture 폴더의 로컬 SCOPE.md는 그 파일을 가리키는 로컬 심볼릭 링크일 뿐이며
 * (gitignore, `.husky/post-checkout`이 `cp -P`로 새 워크트리에 링크째 복사한다),
 * 일반 파일이 생기면 두 사본이 갈라져 어느 쪽이 맞는지 알 수 없게 된다.
 * CI에는 로컬 전용 파일이 없으므로 파일이 없으면 건너뛴다.
 *
 * 대상 경로는 구분자 경계로 `siglens-core` 폴더를 요구한다. `siglens-core-wp1` 같은
 * 코어 워크트리는 정본이 아니므로 일부러 거부한다.
 */
const SCOPE_PATH = path.resolve(
    __dirname,
    '../../../docs/architecture/SCOPE.md'
);
const CORE_TARGET = /[\\/]siglens-core[\\/]docs[\\/]SCOPE\.md$/;
const SECOND_COPY_MESSAGE = 'a second SCOPE.md copy exists; edit the core file';

type ScopeCopyCheck =
    | { status: 'absent' }
    | { status: 'ok' }
    | { status: 'fail'; message: string };

function checkScopeCopy(p: string): ScopeCopyCheck {
    // lstat은 끊어진 링크도 존재로 본다.
    const stat = lstatSync(p, { throwIfNoEntry: false });
    if (stat === undefined) return { status: 'absent' };
    if (!stat.isSymbolicLink()) {
        return { status: 'fail', message: SECOND_COPY_MESSAGE };
    }
    const real = realpathOrNull(p);
    if (real === null) {
        return { status: 'fail', message: `symlink target is missing: ${p}` };
    }
    return CORE_TARGET.test(real)
        ? { status: 'ok' }
        : {
              status: 'fail',
              message: `symlink must resolve to siglens-core/docs/SCOPE.md, got ${real}`,
          };
}

function realpathOrNull(p: string): string | null {
    try {
        return realpathSync(p);
    } catch {
        return null;
    }
}

describe('checkScopeCopy', () => {
    const roots: string[] = [];
    afterEach(() => {
        for (const r of roots.splice(0)) {
            rmSync(r, { recursive: true, force: true });
        }
    });

    function setup(): string {
        const root = mkdtempSync(path.join(tmpdir(), 'scope-guard-'));
        roots.push(root);
        return root;
    }

    function coreFile(root: string, dir: string): string {
        const file = path.join(root, dir, 'docs', 'SCOPE.md');
        mkdirSync(path.dirname(file), { recursive: true });
        writeFileSync(file, '# scope');
        return file;
    }

    it('fails a regular file with the second-copy message', () => {
        const root = setup();
        const p = path.join(root, 'SCOPE.md');
        writeFileSync(p, 'copy');
        expect(checkScopeCopy(p)).toEqual({
            status: 'fail',
            message: SECOND_COPY_MESSAGE,
        });
    });

    it('passes a symlink to siglens-core/docs/SCOPE.md', () => {
        const root = setup();
        const target = coreFile(root, 'siglens-core');
        const p = path.join(root, 'link.md');
        symlinkSync(target, p);
        expect(checkScopeCopy(p)).toEqual({ status: 'ok' });
    });

    it('rejects a symlink into a siglens-core-* worktree and prints the path', () => {
        const root = setup();
        const target = coreFile(root, 'siglens-core-wp1');
        const p = path.join(root, 'link.md');
        symlinkSync(target, p);
        const result = checkScopeCopy(p);
        expect(result.status).toBe('fail');
        expect(result).toMatchObject({
            message: expect.stringContaining(realpathSync(target)),
        });
    });

    it('fails a dangling symlink', () => {
        const root = setup();
        const p = path.join(root, 'link.md');
        symlinkSync(path.join(root, 'siglens-core/docs/SCOPE.md'), p);
        expect(checkScopeCopy(p).status).toBe('fail');
    });

    it('reports absent when nothing exists', () => {
        const root = setup();
        expect(checkScopeCopy(path.join(root, 'none.md'))).toEqual({
            status: 'absent',
        });
    });
});

describe.skipIf(checkScopeCopy(SCOPE_PATH).status === 'absent')(
    'local docs/architecture/SCOPE.md (absent in CI)',
    () => {
        it('is a symlink to the core file', () => {
            const result = checkScopeCopy(SCOPE_PATH);
            expect(
                result.status === 'fail' ? result.message : 'ok',
                'a local SCOPE.md must be a symlink to the core file'
            ).toBe('ok');
        });
    }
);
