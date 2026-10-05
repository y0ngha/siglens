// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestHeaders = vi.hoisted(() => ({
    current: new Headers() as Headers,
}));
vi.mock('next/headers', () => ({
    headers: async () => requestHeaders.current,
}));

import RootNotFound, { generateMetadata } from '../not-found';

function useRequest(entries: Record<string, string>): void {
    requestHeaders.current = new Headers(entries);
}

/**
 * 루트 레이아웃이 없는 자리(전 라우트가 `[locale]/` 아래로 이동)의 404 — 이 파일이
 * 직접 `<html>`/`<body>`와 스타일시트를 맡는다(`global-error.tsx`와 같은 이유).
 * 로케일·호스트는 `params`가 아니라 요청 헤더에서 읽는다.
 */
describe('RootNotFound', () => {
    beforeEach(() => {
        useRequest({});
    });

    describe('헤더가 없을 때 — 한국어 · 메인 호스트로 떨어진다', () => {
        it('404 코드와 한국어 제목·안내를 한 언어로만 보여준다', async () => {
            render(await RootNotFound());

            expect(screen.getByText('404')).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                '페이지를 찾을 수 없습니다'
            );
            expect(screen.queryByText('Page not found')).toBeNull();
            expect(
                screen.getByText(/요청하신 페이지가 존재하지 않거나/)
            ).toBeInTheDocument();
        });

        it('브랜드 바 워드마크와 홈 링크는 전체 페이지 로드가 되는 <a>다', async () => {
            render(await RootNotFound());

            const banner = screen.getByRole('banner');
            const wordmark = within(banner).getByRole('link', {
                name: 'Siglens',
            });
            expect(wordmark.tagName).toBe('A');
            expect(wordmark).toHaveAttribute('href', '/');

            const home = screen.getByRole('link', {
                name: /홈으로 돌아가기/,
            });
            expect(home.tagName).toBe('A');
            expect(home).toHaveAttribute('href', '/');
        });

        it('메인 호스트는 시장 내비 링크를 <a>로 싣는다', async () => {
            render(await RootNotFound());

            const nav = screen.getByRole('navigation');
            const hrefs = within(nav)
                .getAllByRole('link')
                .map(link => link.getAttribute('href'));
            expect(hrefs).toEqual([
                '/market',
                '/fear-greed',
                '/news',
                '/economy',
            ]);
            expect(
                within(nav).getByRole('link', { name: '시장 분석' })
            ).toBeInTheDocument();
        });

        it('html lang은 ko다', async () => {
            const { container } = render(await RootNotFound());

            expect(container.ownerDocument.documentElement).toHaveAttribute(
                'lang',
                'ko'
            );
        });
    });

    describe('로케일 헤더가 있을 때', () => {
        it('en: 영어 한 언어로만 렌더하고 링크에 로케일 접두사를 붙인다', async () => {
            useRequest({ 'x-next-intl-locale': 'en', host: 'siglens.io' });
            render(await RootNotFound());

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                'Page not found'
            );
            expect(screen.queryByText('페이지를 찾을 수 없습니다')).toBeNull();
            expect(
                within(screen.getByRole('banner')).getByRole('link', {
                    name: 'Siglens',
                })
            ).toHaveAttribute('href', '/en');
            expect(
                screen.getByRole('link', { name: /Return to Siglens Home/ })
            ).toHaveAttribute('href', '/en');
            expect(
                within(screen.getByRole('navigation'))
                    .getAllByRole('link')
                    .map(link => link.getAttribute('href'))
            ).toEqual([
                '/en/market',
                '/en/fear-greed',
                '/en/news',
                '/en/economy',
            ]);
            expect(
                screen.getByRole('link', { name: 'Fear & Greed Index' })
            ).toBeInTheDocument();
        });

        it('ja: html lang이 로케일을 따른다', async () => {
            useRequest({ 'x-next-intl-locale': 'ja' });
            const { container } = render(await RootNotFound());

            expect(container.ownerDocument.documentElement).toHaveAttribute(
                'lang',
                'ja'
            );
            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                'ページが見つかりません'
            );
        });

        it('지원하지 않는 로케일은 한국어로 떨어진다', async () => {
            useRequest({ 'x-next-intl-locale': 'xx' });
            render(await RootNotFound());

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                '페이지를 찾을 수 없습니다'
            );
        });
    });

    describe('ai 호스트', () => {
        it('SiglensAI 문구와 새 대화 시작 링크만 보여주고 시장 내비는 없다', async () => {
            useRequest({ host: 'ai.siglens.io' });
            render(await RootNotFound());

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
        });

        it('로케일 접두사를 유지한다', async () => {
            useRequest({ host: 'ai.siglens.io', 'x-next-intl-locale': 'en' });
            render(await RootNotFound());

            expect(
                screen.getByRole('link', { name: 'Start a new chat' })
            ).toHaveAttribute('href', '/en');
        });
    });
});

describe('RootNotFound metadata', () => {
    beforeEach(() => {
        useRequest({});
    });

    it.each([
        [{}, '페이지를 찾을 수 없습니다 | Siglens'],
        [{ 'x-next-intl-locale': 'en' }, 'Page not found | Siglens'],
        [{ 'x-next-intl-locale': 'ja' }, 'ページが見つかりません | Siglens'],
        [{ host: 'ai.siglens.io' }, '페이지를 찾을 수 없습니다 | SIGLENS AI'],
        [
            { host: 'ai.siglens.io', 'x-next-intl-locale': 'en' },
            'Page not found | SIGLENS AI',
        ],
    ])('%j → 제목 %s, noindex·follow', async (request, expected) => {
        useRequest(request);
        const metadata = await generateMetadata();

        expect(metadata.title).toBe(expected);
        expect(metadata.robots).toEqual({ index: false, follow: true });
    });
});
