import { readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import vitestConfig from '../../../vitest.config';

/**
 * **테스트 파일 위치 가드.**
 *
 * vitest의 `include`는 `__tests__/` 아래(또는 `__integration__/`)만 줍는다. 소스 옆에
 * 둔 `foo.test.ts`는 어떤 프로젝트에도 걸리지 않아 **에러 없이 영원히 실행되지 않는다** —
 * 깨져도 초록불이다. vitest가 테스트를 줍는 루트(`src/`·`scripts/`·`cache-handler/`)
 * 아래의 모든 `*.test.{ts,tsx,mjs}`가 최소 한 프로젝트의 `include`에 걸리고
 * `exclude`에 걸리지 않는지 확인한다.
 *
 * glob은 `vitest.config.ts`의 프로젝트 정의를 직접 import해 쓰므로 사본이 없다 —
 * 프로젝트 레인(node/dom/dom-fast)이나 패턴이 바뀌어도 이 가드가 따라간다.
 */
const ROOT_DIR = path.resolve(__dirname, '../../..');
const TEST_ROOTS = ['src', 'scripts', 'cache-handler'] as const;
const TEST_FILE_PATTERN = /\.test\.(tsx?|mjs)$/;

interface ProjectGlobs {
    readonly name: string;
    readonly include: readonly string[];
    readonly exclude: readonly string[];
}

function isStringArray(value: unknown): value is string[] {
    return (
        Array.isArray(value) && value.every(item => typeof item === 'string')
    );
}

function readProjectGlobs(project: unknown): ProjectGlobs[] {
    if (typeof project !== 'object' || project === null) return [];
    if (!('test' in project)) return [];
    const { test } = project;
    if (typeof test !== 'object' || test === null) return [];
    const name =
        'name' in test && typeof test.name === 'string' ? test.name : '';
    const include =
        'include' in test && isStringArray(test.include) ? test.include : [];
    const exclude =
        'exclude' in test && isStringArray(test.exclude) ? test.exclude : [];
    return [{ name, include, exclude }];
}

const PROJECTS: readonly ProjectGlobs[] = (
    vitestConfig.test?.projects ?? []
).flatMap(readProjectGlobs);

function matchesAny(globs: readonly string[], file: string): boolean {
    return globs.some(glob => path.posix.matchesGlob(file, glob));
}

/** `file`을 수집하는 프로젝트 이름들. 비어 있으면 어디서도 실행되지 않는다. */
function owners(file: string): string[] {
    return PROJECTS.filter(
        ({ include, exclude }) =>
            matchesAny(include, file) && !matchesAny(exclude, file)
    ).map(project => project.name);
}

function isCollected(file: string): boolean {
    return owners(file).length > 0;
}

function listTestFiles(): string[] {
    return TEST_ROOTS.flatMap(root =>
        readdirSync(path.join(ROOT_DIR, root), {
            recursive: true,
            encoding: 'utf8',
        })
            .map(rel => `${root}/${rel.split(path.sep).join('/')}`)
            .filter(
                rel =>
                    TEST_FILE_PATTERN.test(rel) &&
                    !rel.split('/').includes('node_modules')
            )
    ).sort();
}

describe('테스트 파일 위치', () => {
    it('vitest 설정에서 프로젝트별 include를 읽어 온다', () => {
        expect(PROJECTS.length).toBeGreaterThan(0);
        expect(
            PROJECTS.every(
                project => project.name !== '' && project.include.length > 0
            )
        ).toBe(true);
    });

    it('테스트 루트 아래의 *.test 파일은 모두 어떤 vitest 프로젝트에 수집된다', () => {
        const orphans = listTestFiles().filter(file => !isCollected(file));

        expect(orphans).toEqual([]);
    });

    it('__tests__ 밖에 둔 테스트 파일은 수집되지 않는 것으로 판정한다', () => {
        expect(isCollected('src/entities/x/lib/cacheKey.test.ts')).toBe(false);
        expect(
            isCollected('src/entities/x/lib/__tests__/cacheKey.test.ts')
        ).toBe(true);
    });

    it('*.test.tsx는 dom 계열 프로젝트에만, *.dom-fast.test.tsx는 dom-fast에만 수집된다', () => {
        expect(owners('src/widgets/a/__tests__/A.test.tsx')).toEqual(['dom']);
        expect(owners('src/widgets/a/__tests__/A.dom-fast.test.tsx')).toEqual([
            'dom-fast',
        ]);
        expect(owners('src/shared/lib/__tests__/a.test.ts')).toEqual(['node']);
    });
});
