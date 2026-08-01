import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * vaul 1.1.2는 `Drawer.Root`의 `modal` prop을 내부 Radix `DialogPrimitive.Root`에
 * 전달하지 않는다(업스트림 이슈 #496). 그 결과 `modal={false}`가 무시되고 Radix가
 * modal 모드로 동작해, 모바일 분석 시트 **밖**의 모든 입력이 포커스를 빼앗긴다.
 * `.yarn/patches/vaul-npm-1.1.2-*.patch`가 passthrough를 복구한다.
 *
 * 이 테스트가 존재하는 이유: `resolutions`가 `vaul@npm:1.1.2`에 핀되어 있어
 * 버전을 올리면 패치가 **조용히** 빠지고 `yarn install`은 성공한다. 설치된
 * 산출물을 직접 읽는 것만이 유실을 잡아낸다.
 */
const require = createRequire(import.meta.url);

/**
 * vaul의 `package.json` `exports` map은 루트 진입점만 노출한다
 * (`import` → `dist/index.mjs`, `require` → `dist/index.js`).
 * 그래서 `require.resolve('vaul/dist/index.mjs')`처럼 딥 서브패스를 직접
 * 요청하면 `ERR_PACKAGE_PATH_NOT_EXPORTED`로 거부된다. 대신 exports가
 * 허용하는 루트 진입점(`require.resolve('vaul')`)을 해석한 뒤, 그 파일이
 * 위치한 `dist` 디렉터리를 기준으로 ESM/CJS 산출물 경로를 유도한다.
 */
function resolveVaulDistDir(): string {
    return path.dirname(require.resolve('vaul'));
}

function readVaulBuild(fileName: string): string {
    return readFileSync(path.join(resolveVaulDistDir(), fileName), 'utf8');
}

describe('vaul patch integrity', () => {
    it('ESM 빌드가 Radix Dialog Root에 modal을 전달한다', () => {
        const source = readVaulBuild('index.mjs');

        expect(source).toContain('createElement(DialogPrimitive.Root, {');
        expect(source).toMatch(
            /createElement\(DialogPrimitive\.Root,\s*\{\s*modal: modal,/
        );
    });

    it('CJS 빌드가 Radix Dialog Root에 modal을 전달한다', () => {
        const source = readVaulBuild('index.js');

        expect(source).toMatch(
            /createElement\(DialogPrimitive__namespace\.Root,\s*\{\s*modal: modal,/
        );
    });
});
