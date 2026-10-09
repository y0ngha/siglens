import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * **구형 브라우저 폴리필 목록 일치 가드**(TOOLCHAIN.md#TC-36).
 *
 * 폴리필 대상은 세 곳에 적혀 있다 — 채우는 쪽(`legacyBrowserPolyfills.ts`), 지우고 단위 시험하는
 * 쪽(그 테스트의 `TARGETS`), 지우고 실제 페이지로 시험하는 쪽(e2e `REMOVE_MODERN_METHODS`). 폴리필을
 * 늘리고 한 곳을 놓치면 그 메서드는 시험되지 않은 채 남으므로 세 목록이 같은지 본다.
 * 설치는 `instrumentation-client.ts` 한 곳에서만 해야 한다(앱 코드보다 먼저 도는 유일한 지점).
 */
const ROOT = path.resolve(__dirname, '../../..');
const read = (rel: string): string =>
    readFileSync(path.join(ROOT, rel), 'utf8');

/** `defineMissing(Array.prototype, 'toSorted', …)` → `Array.prototype.toSorted` */
const DEFINED = /defineMissing\(\s*([\w.]+),\s*'(\w+)'/g;
/** `[Array.prototype, 'toSorted']` → `Array.prototype.toSorted` */
const LISTED = /\[\s*([\w.]+),\s*'(\w+)'\s*\]/g;

function collect(source: string, pattern: RegExp): string[] {
    return [...source.matchAll(pattern)]
        .map(([, target, name]) => `${target}.${name}`)
        .sort();
}

describe('구형 브라우저 폴리필 목록', () => {
    const defined = collect(
        read('src/shared/lib/legacyBrowserPolyfills.ts'),
        DEFINED
    );

    it('채우는 대상이 비어 있지 않다', () => {
        expect(defined.length).toBeGreaterThan(0);
    });

    it('단위 테스트의 삭제 목록과 같다', () => {
        expect(
            collect(
                read('src/shared/lib/__tests__/legacyBrowserPolyfills.test.ts'),
                LISTED
            )
        ).toEqual(defined);
    });

    it('e2e의 삭제 목록과 같다', () => {
        expect(
            collect(read('e2e/specs/legacy-browser.spec.ts'), LISTED)
        ).toEqual(defined);
    });

    it('설치는 instrumentation-client.ts에서만 한다', () => {
        const callers = readdirSync(path.join(ROOT, 'src'), {
            recursive: true,
            encoding: 'utf8',
        })
            .map(rel => rel.split(path.sep).join('/'))
            .filter(
                rel =>
                    /\.tsx?$/.test(rel) &&
                    !/(^|\/)__tests__\//.test(rel) &&
                    /installLegacyBrowserPolyfills\(\)/.test(read(`src/${rel}`))
            )
            .filter(rel => rel !== 'shared/lib/legacyBrowserPolyfills.ts');
        expect(callers).toEqual(['instrumentation-client.ts']);
    });
});
