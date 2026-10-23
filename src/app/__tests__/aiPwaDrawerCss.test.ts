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
