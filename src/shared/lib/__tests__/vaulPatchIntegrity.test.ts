import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * vaul 1.1.2는 `Drawer.Root`의 `modal` prop을 내부 Radix `DialogPrimitive.Root`에
 * 전달하지 않는다(업스트림 이슈 https://github.com/emilkowalski/vaul/issues/496).
 * 그 결과 `modal={false}`가 무시되고 Radix가 modal 모드로 동작해, 모바일 분석
 * 시트 **밖**의 모든 입력이 포커스를 빼앗긴다.
 * `.yarn/patches/vaul-npm-1.1.2-*.patch`가 passthrough를 복구한다.
 *
 * 이 테스트가 존재하는 이유: `package.json`의 `dependencies.vaul`이
 * `patch:vaul@npm%3A1.1.2#~/.yarn/patches/...`로 핀되어 있어, `yarn up vaul`이나
 * Renovate가 버전을 올리면 패치 지정자가 통째로 교체되며 조용히 빠지고
 * `yarn install`은 성공한다. 설치된 산출물을 직접 읽는 것만이 유실을 잡아낸다.
 *
 * D2(감사) — 이 테스트의 제거 조건: 업스트림 이슈 #496이 closed되고 vaul이
 * `modal` passthrough를 정식으로 릴리스하면, `.yarn/patches/vaul-npm-1.1.2-*.patch`
 * 파일과 `package.json`의 `patch:` 지정자와 함께 이 테스트 파일도 삭제한다
 * (`src/views/symbol/MobileAnalysisSheet.tsx`의 JSDoc에 동일 제거 절차가
 * 있다). **주의**: 그 전까지 vaul을 업그레이드하기만 해도(패치를 갱신하지
 * 않은 채) 이 테스트는 설계상 실패한다 — 번들 산출물의 모양이 바뀌어 아래
 * 정규식/문자열 매치가 더는 맞지 않기 때문이다. 그 실패가 바로 "패치를
 * 갱신하거나, 업스트림이 고쳐졌다면 이 테스트를 지우라"는 신호다.
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

/**
 * vaul의 번들(index.mjs/index.js)은 minify되지 않은 채로도 수만 자에 달해서,
 * `expect(source).toMatch(...)`가 실패하면 Vitest diff에 번들 전체가 그대로
 * 찍혀 실제 원인(패치 유실)이 출력 속에 묻힌다. 매칭 지점 주변만 잘라
 * 실패 메시지를 읽을 수 있는 크기로 유지한다. 검증 강도(정규식 자체)는
 * 그대로 두고 입력만 좁힌다.
 */
function extractWindow(source: string, marker: string): string {
    const idx = source.indexOf(marker);
    if (idx === -1) {
        // 마커 자체가 사라진 경우(패치가 완전히 유실된 경우)에도 번들
        // 전체를 쏟아내지 않도록 앞부분만 반환한다 — 아래 toContain이
        // 이 상태를 명확히 실패시킨다.
        return source.slice(0, 200);
    }
    return source.slice(Math.max(0, idx - 60), idx + 160);
}

describe('vaul patch integrity', () => {
    it('ESM 빌드가 Radix Dialog Root에 modal을 전달한다', () => {
        const source = readVaulBuild('index.mjs');
        const snippet = extractWindow(source, 'DialogPrimitive.Root');

        expect(snippet).toContain('createElement(DialogPrimitive.Root, {');
        expect(snippet).toMatch(
            /createElement\(DialogPrimitive\.Root,\s*\{\s*modal: modal,/
        );
    });

    it('CJS 빌드가 Radix Dialog Root에 modal을 전달한다', () => {
        const source = readVaulBuild('index.js');
        const snippet = extractWindow(
            source,
            'DialogPrimitive__namespace.Root'
        );

        expect(snippet).toContain(
            'createElement(DialogPrimitive__namespace.Root, {'
        );
        expect(snippet).toMatch(
            /createElement\(DialogPrimitive__namespace\.Root,\s*\{\s*modal: modal,/
        );
    });
});
