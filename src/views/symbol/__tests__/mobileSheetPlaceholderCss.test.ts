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

describe('globals.css — 펼친 모바일 시트의 Ask-AI FAB·PWA 배너 규칙', () => {
    const css = readFileSync(
        join(process.cwd(), 'src/app/globals.css'),
        'utf-8'
    );
    const normalized = css.replace(/\s+/g, ' ');

    it('시트가 PEEK 밖으로 펼쳐지면 FAB과 PWA 설치 배너를 숨기는 규칙이 있다', () => {
        expect(normalized).toContain(
            'body:has([data-vaul-drawer][data-sheet-expanded]) [data-ask-ai-fab], body:has([data-vaul-drawer][data-sheet-expanded]) [data-pwa-banner] { display: none; }'
        );
    });

    /**
     * 하단 오버레이는 한 번에 하나다(일시·모달 UI > 시트 > Ask-AI 링크 > 설치 배너).
     * 차트 탭은 패널 본문의 인라인 링크가 떠 있는 버튼을 대신하고, 링크가 있는 화면에는 배너가 없다.
     */
    it('인라인 Ask-AI 링크가 있으면 떠 있는 버튼을 숨긴다', () => {
        expect(normalized).toContain(
            'body:has([data-ask-ai-inline]) [data-ask-ai-fab] { display: none; }'
        );
    });

    it('떠 있는 Ask-AI 버튼이 있는 화면에는 PWA 설치 배너를 숨긴다', () => {
        expect(normalized).toContain(
            'body:has([data-ask-ai-fab]) [data-pwa-banner] { display: none; }'
        );
    });

    it('배너 위로 버튼을 들어 올리던 규칙은 없다 — 둘이 함께 보이는 화면이 없다', () => {
        expect(normalized).not.toContain(
            'body:has([data-pwa-banner]) [data-ask-ai-fab]'
        );
        expect(normalized).not.toContain('safe-area-inset-bottom) + 3.5rem');
    });

    it('규칙이 인라인 링크·배너 컴포넌트가 실제로 다는 속성명을 쓴다', () => {
        const inline = readFileSync(
            join(
                process.cwd(),
                'src/widgets/ask-ai-fab/ui/AskAiInlineLink.tsx'
            ),
            'utf-8'
        );
        const banner = readFileSync(
            join(process.cwd(), 'src/features/pwa-install/ui/PwaBanner.tsx'),
            'utf-8'
        );
        expect(inline).toContain('data-ask-ai-inline');
        expect(banner).toContain('data-pwa-banner');
    });

    it('규칙이 시트·FAB 컴포넌트가 실제로 다는 속성명을 쓴다', () => {
        const sheet = readFileSync(
            join(process.cwd(), 'src/views/symbol/MobileAnalysisSheet.tsx'),
            'utf-8'
        );
        const fab = readFileSync(
            join(process.cwd(), 'src/widgets/ask-ai-fab/AskAiFab.tsx'),
            'utf-8'
        );

        expect(sheet).toContain('data-sheet-expanded');
        expect(fab).toContain('data-ask-ai-fab');
    });
});

describe('globals.css — 차트 헤더 팝오버가 열린 동안 PWA 배너·FAB 숨김', () => {
    const normalized = readFileSync(
        join(process.cwd(), 'src/app/globals.css'),
        'utf-8'
    ).replace(/\s+/g, ' ');

    it('data-chart-popover가 있으면 배너와 Ask-AI FAB을 숨기는 규칙이 있다', () => {
        expect(normalized).toContain(
            'body:has([data-chart-popover]) [data-ask-ai-fab], body:has([data-chart-popover]) [data-pwa-banner] { display: none; }'
        );
    });

    it('규칙의 표식을 ChartPopoverPanel이 실제로 단다', () => {
        const panel = readFileSync(
            join(process.cwd(), 'src/widgets/chart/ui/ChartPopoverPanel.tsx'),
            'utf-8'
        );
        expect(panel).toContain('data-chart-popover');
    });
});
