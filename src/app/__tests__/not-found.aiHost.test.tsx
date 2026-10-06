// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://ai.siglens.io/foo/bar"}
import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
    hydrateServerMarkup,
    removeTitles,
    renderRoot,
    visit,
} from './notFoundHarness';

/**
 * ai 호스트 주소(`ai.siglens.io`)에서의 루트 404. jsdom의 기본 URL을 이 파일에서만 ai 호스트로
 * 바꾼다 — `window.location.hostname`은 덮어쓸 수 없어서다. 호스트 판정은 목 없이 실제
 * `window.location`을 읽는다.
 */
describe('RootNotFound — ai 호스트', () => {
    afterEach(() => {
        // RTL 렌더가 소유한 `<title>`은 언마운트로 걷고, 하이드레이션 테스트(언마운트 없음)가
        // 남긴 것은 직접 걷는다 — 순서가 바뀌면 React가 이미 사라진 `<title>`을 지우려다 깨진다.
        cleanup();
        document.body.innerHTML = '';
        removeTitles();
        document.documentElement.lang = '';
        visit('/foo/bar');
    });

    it('SiglensAI 문구와 새 대화 시작 링크만 보여주고 시장 내비는 없다', async () => {
        await renderRoot();

        expect(window.location.hostname).toBe('ai.siglens.io');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            '페이지를 찾을 수 없습니다'
        );
        expect(
            within(screen.getByRole('banner')).getByRole('link', {
                name: 'SIGLENS AI',
            })
        ).toHaveAttribute('href', '/');
        expect(
            screen.getByRole('link', { name: '새 대화 시작' })
        ).toHaveAttribute('href', '/');
        expect(screen.queryByRole('navigation')).toBeNull();
        expect(screen.queryByText(/요청하신 페이지가/)).toBeNull();
        expect(document.title).toBe('페이지를 찾을 수 없습니다 | SIGLENS AI');
    });

    it('로케일 접두사를 유지한다', async () => {
        visit('/en/foo');
        await renderRoot();

        expect(
            screen.getByRole('link', { name: 'Start a new chat' })
        ).toHaveAttribute('href', '/en');
        expect(document.title).toBe('Page not found | SIGLENS AI');
        expect(document.documentElement.lang).toBe('en');
    });

    it('ai 호스트 주소에서 하이드레이션해도 불일치 오류가 없고 SiglensAI 문구로 바뀐다', async () => {
        const out = await hydrateServerMarkup();

        expect(out.recoverableErrors).toEqual([]);
        expect(out.consoleErrors).toEqual([]);
        expect(
            within(out.container).getByRole('link', { name: '새 대화 시작' })
        ).toBeInTheDocument();
        expect(document.title).toBe('페이지를 찾을 수 없습니다 | SIGLENS AI');
    });
});
