import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `MobileSheetPlaceholder`는 JS가 아니라 **CSS로** 사라진다 — 실제 vaul 시트가 DOM에
 * 들어오면 `globals.css`의 `:has()` 규칙이 껍데기를 숨긴다. 컴포넌트 렌더 테스트로는
 * 이 규칙의 존재를 검증할 수 없어(빌드된 CSS가 jsdom에 적용되지 않음) 소스를 직접 읽는다.
 *
 * 이 규칙이 사라지면 실제 시트가 떠도 껍데기가 남아, 사용자가 시트를 위로 끌어올린
 * 뒤에도 하단에 유령 띠가 보인다. `vaulPatchIntegrity.test.ts`와 같은 성격의 가드다.
 */
describe('globals.css — 모바일 시트 껍데기 해제 규칙', () => {
    const css = readFileSync(
        join(process.cwd(), 'src/app/globals.css'),
        'utf-8'
    );

    it('vaul 시트가 마운트되면 껍데기를 숨기는 규칙이 있다', () => {
        // 공백 차이에 취약하지 않도록 정규화 후 검사한다.
        const normalized = css.replace(/\s+/g, ' ');
        expect(normalized).toContain(
            'body:has([data-vaul-drawer]) [data-mobile-sheet-placeholder] { display: none; }'
        );
    });

    it('선택자가 vaul의 실제 속성명을 쓴다', () => {
        // vaul이 붙이는 속성은 `data-vaul-drawer`다(node_modules/vaul/dist 확인).
        // 업그레이드로 속성명이 바뀌면 이 테스트가 아니라 실제 화면이 조용히 깨지므로,
        // 최소한 선택자가 그 이름을 참조하고 있다는 사실만이라도 고정해 둔다.
        expect(css).toContain('[data-vaul-drawer]');
    });
});
