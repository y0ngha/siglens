import { describe, expect, it } from 'vitest';
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
        expect(() => grepFiles('x', ['src/__no_such_dir__'])).toThrow();
    });
});
