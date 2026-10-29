/**
 * `AskAiFab` 렌더 계약 — 링크 대상(href)·새 탭 속성·접근성 이름·고정 위치 클래스.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AskAiFab } from '../AskAiFab';
import { aiAskUrl } from '@/shared/config/aiHost';

/** async 서버 컴포넌트라 element 트리를 await한 뒤 렌더한다. */
async function renderFab(name: string, localePrefix: string) {
    return render(await AskAiFab({ name, localePrefix }));
}

describe('AskAiFab', () => {
    it('시그렌즈 AI에게 물어보기 라벨을 렌더한다', async () => {
        await renderFab('애플', '/');

        expect(screen.getByText('시그렌즈 AI에게 물어보기')).toBeVisible();
    });

    it('href가 aiAskUrl(localePrefix, question)과 같다 — 질문에 종목명이 들어간다', async () => {
        await renderFab('애플', '/');

        const link = screen.getByRole('link');
        const expectedQuestion = '애플 지금 어떤 상황인지 종합적으로 알려줘';
        expect(link).toHaveAttribute('href', aiAskUrl('/', expectedQuestion));
    });

    it('모바일 시트가 펼쳐질 때 CSS가 숨길 수 있게 data-ask-ai-fab 속성을 단다', async () => {
        await renderFab('애플', '/');

        expect(screen.getByRole('link')).toHaveAttribute('data-ask-ai-fab');
    });

    it('새 탭으로 열린다 (target=_blank, rel=nofollow noopener)', async () => {
        await renderFab('애플', '/');

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('target', '_blank');
        // nofollow — 종목별 고유 `?q=` URL로 크롤 예산이 새지 않게 한다.
        expect(link).toHaveAttribute('rel', 'nofollow noopener');
    });

    it('모바일은 짧은 라벨(sm:hidden), 데스크톱은 전체 라벨(hidden sm:inline)을 렌더한다', async () => {
        await renderFab('애플', '/');

        const shortLabel = screen.getByText('AI에게 묻기');
        expect(shortLabel.className).toContain('sm:hidden');

        const fullLabel = screen.getByText('시그렌즈 AI에게 물어보기');
        expect(fullLabel.className).toContain('hidden');
        expect(fullLabel.className).toContain('sm:inline');
    });

    it('별 아이콘이 아니라 AI 스파클 아이콘을 렌더한다', async () => {
        const { container } = await renderFab('애플', '/');

        const paths = Array.from(container.querySelectorAll('svg path')).map(
            p => p.getAttribute('d')
        );
        // 5각 별 path는 "즐겨찾기"로 읽히므로 쓰지 않는다.
        expect(paths.some(d => d?.startsWith('M9.049 2.927'))).toBe(false);
        // 스파클(두 개의 다이아몬드) path를 렌더한다.
        expect(paths).toContain(
            'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z'
        );
    });

    it('question을 주면 종목명 질문 대신 그 문장이 href에 실린다', async () => {
        render(
            await AskAiFab({
                question: '가이드: RSI — 차트 예시와 함께 쉽게 설명해 줘',
                localePrefix: '/',
            })
        );

        expect(screen.getByRole('link')).toHaveAttribute(
            'href',
            aiAskUrl('/', '가이드: RSI — 차트 예시와 함께 쉽게 설명해 줘')
        );
    });

    it('question을 줄 때도 라벨·새 탭·nofollow 계약은 그대로다', async () => {
        render(await AskAiFab({ question: '질문', localePrefix: '/' }));

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'nofollow noopener');
        expect(link).toHaveAttribute('data-ask-ai-fab');
        expect(screen.getByText('시그렌즈 AI에게 물어보기')).toBeVisible();
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

    describe('접근성 이름', () => {
        // 모바일은 짧은 라벨만 보인다. 이름을 `aria-label`로 못박으면 보이는 글자가
        // 이름에 없어 음성 제어가 링크를 못 찾는다 — 이름은 보이는 텍스트에서 나와야 한다.
        it('aria-label로 이름을 덮어쓰지 않고, 짧은 라벨이 이름에 들어간다', async () => {
            await renderFab('애플', '/');

            const link = screen.getByRole('link');
            expect(link).not.toHaveAttribute('aria-label');
            expect(link).toHaveAccessibleName(/AI에게 묻기/);
        });

        it('전체 라벨과 새 탭 안내가 이름에 들어간다', async () => {
            await renderFab('애플', '/');

            const link = screen.getByRole('link');
            expect(link).toHaveAccessibleName(/시그렌즈 AI에게 물어보기/);
            expect(link).toHaveAccessibleName(/\(새 탭\)$/);
        });

        it('새 탭 안내는 화면에 보이지 않는 sr-only 조각이다', async () => {
            await renderFab('애플', '/');

            expect(screen.getByText('(새 탭)')).toHaveClass('sr-only');
        });
    });

    // 라이트 테마는 primary-500(링)과 primary-600(버튼 면)이 같은 값이라, 간격 없이
    // 붙은 링은 버튼 면과 구분되지 않는다.
    it('포커스 링을 버튼 면에서 띄우는 ring-offset을 단다', async () => {
        await renderFab('애플', '/');

        expect(screen.getByRole('link')).toHaveClass(
            'focus-visible:ring-2',
            'focus-visible:ring-primary-500',
            'focus-visible:ring-offset-2',
            'focus-visible:ring-offset-secondary-900'
        );
    });

    // `viewportFit: 'cover'`라 가로 모드 iPhone(폭 768px 이상 → md)에서는 노치가 오른쪽
    // 인셋(약 47px)을 차지한다. 고정 오프셋(24px)만 주면 버튼이 노치 밑으로 들어간다.
    it('오른쪽 오프셋이 모든 폭에서 safe-area-inset-right 이상이다', async () => {
        await renderFab('애플', '/');

        expect(screen.getByRole('link')).toHaveClass(
            'right-[max(1rem,env(safe-area-inset-right))]',
            'md:right-[max(1.5rem,env(safe-area-inset-right))]'
        );
    });
});
