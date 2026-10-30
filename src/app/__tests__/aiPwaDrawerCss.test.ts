import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(path.resolve(__dirname, '../globals.css'), 'utf8');

/**
 * ai 호스트의 설치 배너는 상단(z-65)에 떠서 모바일 대화 목록 드로어(z-60)의 첫 줄 —
 * 홈 링크·닫기 버튼 — 을 덮는다. 드로어가 열려 있는 동안 배너를 숨기는 규칙이 드로어
 * 콘텐츠의 실제 id를 가리키는지 고정한다(id가 바뀌면 규칙이 조용히 죽는다).
 */
describe('globals.css — SIGLENS AI 드로어가 열리면 설치 배너를 숨긴다', () => {
    it('드로어 id로 배너를 숨기는 규칙이 있다', () => {
        expect(css).toMatch(
            /body:has\(#agent-chat-sidebar-drawer\) \[data-pwa-banner\]\s*\{\s*display: none;/
        );
    });

    it('규칙이 가리키는 id를 SidebarDrawer가 실제로 쓴다', () => {
        const drawer = readFileSync(
            path.resolve(
                __dirname,
                '../../widgets/agent-chat/SidebarDrawer.tsx'
            ),
            'utf8'
        );
        expect(drawer).toContain('id="agent-chat-sidebar-drawer"');
    });
});

/**
 * 상단 배치 배너의 세로 위치는 크롬 구성을 보고 globals.css가 정한다(`--pwa-banner-top`,
 * 크롬이 숨으면 `translate`). 규칙이 기대는 속성·높이 변수가 컴포넌트에서 사라지면 배너가
 * 헤더·띠 위로 겹쳐 버튼을 가린다.
 */
describe('globals.css — 상단 배너는 크롬 아래에 뜬다', () => {
    const rule = (selector: string) => {
        const at = css.indexOf(`${selector} {`);
        expect(at, selector).toBeGreaterThan(-1);
        return css.slice(at, css.indexOf('}', at));
    };

    it('기본·대화 화면·/about 위치와 크롬 숨김 이동 규칙이 있다', () => {
        expect(rule('[data-pwa-banner]')).toContain(
            '--pwa-banner-top: calc(var(--header-h) + 0.5rem)'
        );
        expect(
            rule('body:has(:where([data-agent-chat-bar])) [data-pwa-banner]')
        ).toMatch(/var\(--header-h\) \+ var\(--agent-chat-bar-h\)/);
        expect(
            rule('body:has(:where([data-ai-about-cta])) [data-pwa-banner]')
        ).toMatch(/var\(--header-h\) \+ var\(--ai-about-cta-h\)/);
        expect(
            rule(
                'body:has(:where(header[data-scroll-chrome][inert])) [data-pwa-banner]'
            )
        ).toContain('--pwa-banner-shift');
    });

    /** 보이는 고정 요소의 `top`을 바꾸면 스크롤마다 CLS가 쌓인다 — 이동은 `translate`로. */
    it('크롬이 숨을 때 top이 아니라 translate로 옮긴다', () => {
        const base = rule('[data-pwa-banner]');
        expect(base).toContain('translate: 0 var(--pwa-banner-shift)');
        expect(base).not.toMatch(/transition:\s*top/);
    });

    /** 조건 규칙은 명시도가 같아 순서로 이긴다 — 크롬 숨김 규칙이 화면별 규칙보다 뒤여야 한다. */
    it('크롬 숨김 규칙이 화면별 규칙보다 뒤에 있다', () => {
        const hidden = css.indexOf(
            'body:has(:where(header[data-scroll-chrome][inert])) [data-pwa-banner]'
        );
        for (const selector of [
            'body:has(:where([data-agent-chat-bar])) [data-pwa-banner]',
            'body:has(:where([data-ai-about-cta])) [data-pwa-banner]',
        ]) {
            expect(hidden).toBeGreaterThan(css.indexOf(selector));
        }
    });

    it('규칙이 기대는 속성과 높이 변수를 헤더·띠가 실제로 쓴다', () => {
        const read = (rel: string) =>
            readFileSync(path.resolve(__dirname, rel), 'utf8');
        const header = read('../../widgets/layout/ui/header/HeaderShell.tsx');
        expect(header).toMatch(/<header\s+data-scroll-chrome=""/);
        expect(header).toContain('h-(--header-h)');
        const chatBar = read(
            '../../widgets/agent-chat/shell/MobileChatBar.tsx'
        );
        expect(chatBar).toContain('data-agent-chat-bar=""');
        expect(chatBar).toContain('h-(--agent-chat-bar-h)');
        const about = read('../../views/ai-about/ui/AboutCtaBar.tsx');
        expect(about).toContain('data-ai-about-cta=""');
        expect(about).toContain('h-(--ai-about-cta-h)');
    });
});
