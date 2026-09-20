import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AskAiFab } from '../AskAiFab';
import { aiAskUrl } from '@/shared/config/aiHost';

/** async 서버 컴포넌트라 element 트리를 await한 뒤 렌더한다. */
async function renderFab(name: string, localePrefix: string) {
    return render(await AskAiFab({ name, localePrefix }));
}

describe('AskAiFab', () => {
    it('SIGLENS AI에게 물어보기 라벨을 렌더한다', async () => {
        await renderFab('애플', '/');

        expect(screen.getByText('SIGLENS AI에게 물어보기')).toBeVisible();
    });

    it('href가 aiAskUrl(localePrefix, question)과 같다 — 질문에 종목명이 들어간다', async () => {
        await renderFab('애플', '/');

        const link = screen.getByRole('link');
        const expectedQuestion = '애플 지금 어떤 상황인지 종합적으로 알려줘';
        expect(link).toHaveAttribute('href', aiAskUrl('/', expectedQuestion));
    });

    it('새 탭으로 열린다 (target=_blank, rel=noopener)', async () => {
        await renderFab('애플', '/');

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener');
    });

    it('모바일은 짧은 라벨(sm:hidden), 데스크톱은 전체 라벨(hidden sm:inline)을 렌더한다', async () => {
        await renderFab('애플', '/');

        const shortLabel = screen.getByText('AI에게 묻기');
        expect(shortLabel.className).toContain('sm:hidden');

        const fullLabel = screen.getByText('SIGLENS AI에게 물어보기');
        expect(fullLabel.className).toContain('hidden');
        expect(fullLabel.className).toContain('sm:inline');
    });

    it('별 아이콘이 아니라 AI 스파클 아이콘을 렌더한다', async () => {
        const { container } = await renderFab('애플', '/');

        const paths = Array.from(container.querySelectorAll('svg path')).map(
            p => p.getAttribute('d')
        );
        // 5-point star path (기존 "즐겨찾기"로 오독되던 아이콘)는 더 이상 없다.
        expect(paths.some(d => d?.startsWith('M9.049 2.927'))).toBe(false);
        // 스파클(두 개의 다이아몬드) path가 대신 렌더된다.
        expect(paths).toContain(
            'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z'
        );
    });

    // 실제 번역 카탈로그는 이 트리 위(RouteMessages)의 `setRequestLocale`이
    // 정하므로, 컴포넌트 단위 테스트에서는 앰비언트 로케일이 항상 ko다.
    // 여기서 검증할 것은 번역 문구가 아니라 이 컴포넌트가 `localePrefix` prop을
    // `aiAskUrl`에 그대로 꽂는지다 — 비기본 로케일에서는 접두 경로가 붙는다.
    it('비기본 로케일의 localePrefix가 href 경로에 그대로 반영된다', async () => {
        await renderFab('애플', '/en');

        const link = screen.getByRole('link');
        const href = link.getAttribute('href');
        expect(href).not.toBeNull();
        expect(new URL(href!).pathname).toBe('/en');
    });
});
