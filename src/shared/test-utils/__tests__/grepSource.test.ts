import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { grepFiles } from '@/shared/test-utils/grepSource';

describe('grepFiles', () => {
    it('매치가 없으면 빈 배열을 돌려준다', () => {
        expect(grepFiles('zzz[q]uux', ['src/shared/test-utils'])).toEqual([]);
    });

    it('매치가 있으면 파일 경로를 돌려준다', () => {
        expect(
            grepFiles('export function grep[F]iles', ['src/shared/test-utils'])
        ).toEqual(['src/shared/test-utils/grepSource.ts']);
    });

    it('존재하지 않는 경로는 빈 결과로 삼키지 않고 던진다', () => {
        expect(() => grepFiles('x', ['src/__no_such_dir__'])).toThrow(
            'src/__no_such_dir__'
        );
    });
});

describe('grepFiles on a grep that exits 1 for a missing path (BSD grep)', () => {
    const fakeBinDirs: string[] = [];

    afterEach(() => {
        vi.unstubAllEnvs();
        fakeBinDirs.splice(0).forEach(dir => {
            rmSync(dir, { recursive: true, force: true });
        });
    });

    function stubBsdGrep(): void {
        const dir = mkdtempSync(join(tmpdir(), 'fake-bsd-grep-'));
        fakeBinDirs.push(dir);
        const script = join(dir, 'grep');
        writeFileSync(script, '#!/bin/sh\nexit 1\n');
        chmodSync(script, 0o755);
        vi.stubEnv('PATH', dir);
    }

    it('grep이 1을 돌려줘도 없는 경로는 던진다', () => {
        stubBsdGrep();
        expect(() => grepFiles('x', ['src/__no_such_dir__'])).toThrow(
            'path does not exist'
        );
    });

    it('경로가 있으면 그 grep의 종료 코드 1을 매치 없음으로 읽는다', () => {
        stubBsdGrep();
        expect(grepFiles('x', ['src/shared/test-utils'])).toEqual([]);
    });
});
