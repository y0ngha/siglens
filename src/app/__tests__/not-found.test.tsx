// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resolverSpy = vi.hoisted(() => ({
    calls: [] as Array<[string, string]>,
}));
vi.mock('@/shared/i18n/locationSurface', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@/shared/i18n/locationSurface')>();
    return {
        ...actual,
        resolveLocationSurface: (hostname: string, pathname: string) => {
            resolverSpy.calls.push([hostname, pathname]);
            return actual.resolveLocationSurface(hostname, pathname);
        },
    };
});

import { buildOverrides } from '@/app/_components/notFoundOverrides';
import { generateMetadata } from '../not-found';
import { hydrateServerMarkup, renderRoot, visit } from './notFoundHarness';

/**
 * 루트 레이아웃이 없는 자리(전 라우트가 `[locale]/` 아래로 이동)의 404 — 이 파일이
 * 직접 `<html>`/`<body>`와 스타일시트를 맡는다(`global-error.tsx`와 같은 이유).
 *
 * 서버는 한국어 · 메인 호스트 한 벌만 정적으로 그리고, 로케일·호스트는 클라이언트 섬이
 * 마운트 뒤 주소로 알아내 바꾼다.
 */
describe('RootNotFound', () => {
    beforeEach(() => {
        visit('/');
    });
    afterEach(() => {
        document.title = '';
        document.documentElement.lang = '';
    });

    describe('기본(주소가 한국어 메인 호스트일 때)', () => {
        it('404 코드와 한국어 제목·안내를 한 언어로만 보여준다', async () => {
            visit('/foo/bar');
            await renderRoot();

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
            await renderRoot();

            const wordmark = within(screen.getByRole('banner')).getByRole(
                'link',
                { name: 'Siglens' }
            );
            expect(wordmark.tagName).toBe('A');
            expect(wordmark).toHaveAttribute('href', '/');
            const home = screen.getByRole('link', { name: /홈으로 돌아가기/ });
            expect(home.tagName).toBe('A');
            expect(home).toHaveAttribute('href', '/');
        });

        it('시장 내비 링크를 <a>로 싣는다', async () => {
            await renderRoot();

            const nav = screen.getByRole('navigation');
            expect(
                within(nav)
                    .getAllByRole('link')
                    .map(link => link.getAttribute('href'))
            ).toEqual(['/market', '/fear-greed', '/news', '/economy']);
        });

        it('html lang은 ko다', async () => {
            const { container } = await renderRoot();

            expect(container.ownerDocument.documentElement).toHaveAttribute(
                'lang',
                'ko'
            );
        });
    });

    describe('마운트 뒤 주소로 로케일을 알아낸다', () => {
        it('/en/...: 영어로 바뀌고 홈 링크에 접두사가 붙으며 제목·lang이 맞춰진다', async () => {
            visit('/en/foo/bar');
            await renderRoot();

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                'Page not found'
            );
            expect(screen.queryByText('페이지를 찾을 수 없습니다')).toBeNull();
            expect(
                within(screen.getByRole('banner')).getByRole('link', {
                    name: 'Siglens',
                })
            ).toHaveAttribute('href', '/en');
            // 비기본 표면은 홈 링크만 — 내비·바로가기는 한국어 서버 마크업에만 있다.
            expect(screen.queryByRole('navigation')).toBeNull();
            expect(
                screen.getByRole('link', { name: /Return to Siglens Home/ })
            ).toHaveAttribute('href', '/en');
            expect(document.title).toBe('Page not found | Siglens');
            expect(document.documentElement.lang).toBe('en');
        });

        it('/ja/...: 일본어로 바뀐다', async () => {
            visit('/ja/foo/bar');
            await renderRoot();

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                'ページが見つかりません'
            );
            expect(document.documentElement.lang).toBe('ja');
        });

        it('지원하지 않는 접두사는 한국어로 남는다', async () => {
            visit('/xx/foo');
            await renderRoot();

            expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
                '페이지를 찾을 수 없습니다'
            );
        });
    });

    it('주소 판정에 실제 window.location의 hostname·pathname을 넘긴다 — 우회 없음', async () => {
        visit('/ja/foo/bar');
        resolverSpy.calls.length = 0;

        await renderRoot();

        expect(resolverSpy.calls.length).toBeGreaterThan(0);
        for (const call of resolverSpy.calls) {
            expect(call).toEqual([window.location.hostname, '/ja/foo/bar']);
        }
    });
});

describe('RootNotFound metadata', () => {
    it('제목은 정적이다 — 한국어 · 메인 호스트, noindex·follow', async () => {
        const metadata = await generateMetadata();

        expect(metadata.title).toBe('페이지를 찾을 수 없습니다 | Siglens');
        expect(metadata.robots).toEqual({ index: false, follow: true });
    });
});

/**
 * **루트 404는 요청 API를 쓰면 안 된다.** 이 경계는 모든 라우트 트리의 일부로 렌더되므로
 * `headers()`를 읽는 순간 ISR 페이지 전부가 런타임에 동적으로 바뀌어 500이 된다(`Page
 * changed from static to dynamic at runtime /ko/AAPL, reason: headers` — e2e 실측).
 * 단위 테스트는 jsdom이라 이 오류를 재현할 수 없으므로 소스를 직접 고정한다.
 */
describe('루트 404는 정적이다 — 요청 API 금지', () => {
    const root = process.cwd();
    const files = [
        'src/app/not-found.tsx',
        'src/app/_components/NotFoundView.tsx',
        'src/app/_components/NotFoundLayout.tsx',
        'src/app/_components/notFoundOverrides.ts',
        'src/shared/i18n/locationSurface.ts',
    ];

    it.each(files)('%s: next/headers·동적 API를 쓰지 않는다', file => {
        const code = readFileSync(join(root, file), 'utf8')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/(?<![:/])\/\/.*$/gm, '');

        expect(code).not.toMatch(/next\/headers/);
        expect(code).not.toMatch(/\b(?:headers|cookies|connection)\(/);
    });
});

/**
 * 서버 마크업은 늘 한국어 · 메인 호스트 한 벌이다. 클라이언트가 **다른 주소**에서 하이드레이션해도
 * 불일치 오류 없이(첫 렌더는 서버와 같은 스냅샷) 마운트 뒤에야 문구가 바뀌어야 한다.
 */
describe('NotFoundView 하이드레이션', () => {
    afterEach(() => {
        document.body.innerHTML = '';
        document.title = '';
        document.documentElement.lang = '';
    });

    it('기본 주소에서는 서버 마크업 그대로이고 오류가 없다', async () => {
        const out = await hydrateServerMarkup('/foo/bar', '/foo/bar');

        expect(out.recoverableErrors).toEqual([]);
        expect(out.consoleErrors).toEqual([]);
        expect(out.container.querySelector('h1')).toHaveTextContent(
            '페이지를 찾을 수 없습니다'
        );
    });

    it('/en/foo에서 하이드레이션해도 불일치 오류가 없고, 하이드레이션 뒤 영어로 바뀐다', async () => {
        const out = await hydrateServerMarkup('/foo', '/en/foo');

        expect(out.recoverableErrors).toEqual([]);
        expect(out.consoleErrors).toEqual([]);
        expect(out.container.querySelector('h1')).toHaveTextContent(
            'Page not found'
        );
        expect(
            within(out.container).getByRole('link', {
                name: /Return to Siglens Home/,
            })
        ).toHaveAttribute('href', '/en');
        expect(document.title).toBe('Page not found | Siglens');
        expect(document.documentElement.lang).toBe('en');
    });
});

describe('비기본 표면 props의 크기', () => {
    /**
     * 이 props는 모든 페이지의 Flight 페이로드에 실린다. 한국어 · 메인 호스트 전체 문구와
     * 내비·바로가기를 8벌 모두 넘기던 때는 JSON 3,099자였고, 비기본 표면의 최소 문구만
     * 넘기는 지금은 1,000자 안팎이다.
     */
    it('JSON 직렬화가 1,500자를 넘지 않는다', async () => {
        const overrides = await buildOverrides();

        expect(JSON.stringify(overrides).length).toBeLessThan(1500);
    });

    it('한국어 · 메인 호스트 문구와 내비·바로가기는 props에 없다', async () => {
        const overrides = await buildOverrides();

        expect(overrides.site).not.toHaveProperty('ko');
        expect(Object.keys(overrides.site).toSorted()).toEqual([
            'en',
            'ja',
            'zh',
        ]);
        expect(Object.keys(overrides.ai).toSorted()).toEqual([
            'en',
            'ja',
            'ko',
            'zh',
        ]);
        const json = JSON.stringify(overrides);
        expect(json).not.toContain('navLinks');
        expect(json).not.toContain('shortcuts');
    });
});
