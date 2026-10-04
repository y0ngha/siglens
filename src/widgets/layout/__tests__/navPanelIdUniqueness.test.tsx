vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react';
import { HeaderNav } from '../HeaderNav';
import { NAV_TREE } from '../headerNavTree';

/**
 * 헤더 내비의 패널 id는 문서에서 하나뿐이어야 한다.
 *
 * 무엇이 깨졌었나: 예전에는 `Header`가 내비를 `<Suspense>`로 감싸고 fallback으로
 * 같은 `HeaderNavMenu`를 렌더하는 정적 판(`HeaderNavStatic`)을 뒀다. 둘이 같은 트리
 * 위치라 `useId()`가 **같은 값**을 발급했고, 서빙 HTML에는 fallback과 본체가 둘 다
 * 들어가 같은 id가 두 번 남았다 — **보이는 메뉴의 `aria-controls`가 숨겨진
 * fallback의 패널을 가리켰다**(실측 `/news`: 주요 내비 nav 2개, 중복 id 4개).
 * `idScope`로 id를 갈라 막았지만, 같은 7.5KB 마크업이 전 페이지 HTML에 두 번
 * 실리는 것은 그대로였다(2026-10-04 운영 HTML: `<template id="B:0">` fallback +
 * `<div hidden id="S:0">` 본체).
 *
 * 지금은 경계와 정적 판을 없앴다. 경계가 필요했던 이유(PPR 정적 셸)는
 * `cacheComponents`가 꺼진 지금 성립하지 않고, ISR 응답은 통째로 버퍼링돼
 * 스트리밍 이득도 없다.
 *
 * **왜 소스 가드인가.** id 충돌은 스트리밍 SSR에서만 성립하고 jsdom에는 그 경로가
 * 없어 렌더 테스트로 재현되지 않는다. 그래서 결함의 전제 — 같은 메뉴를 그리는
 * 호출부가 둘이 되는 것, 헤더가 내비를 경계로 감싸는 것 — 을 직접 본다.
 */

const LAYOUT_DIR = path.resolve(__dirname, '..');

/** 테스트가 아닌 레이아웃 소스 중 `<HeaderNavMenu`를 렌더하는 파일. */
function navMenuCallSites(): string[] {
    return readdirSync(LAYOUT_DIR)
        .filter(file => file.endsWith('.tsx'))
        .filter(file =>
            readFileSync(path.join(LAYOUT_DIR, file), 'utf8').includes(
                '<HeaderNavMenu'
            )
        );
}

describe('nav 패널 id 유일성', () => {
    it('HeaderNavMenu 호출부는 HeaderNav 하나뿐이다', () => {
        expect(navMenuCallSites()).toEqual(['HeaderNav.tsx']);
    });

    it('헤더는 내비를 Suspense로 감싸지 않는다', () => {
        const source = readFileSync(
            path.join(LAYOUT_DIR, 'Header.tsx'),
            'utf8'
        );
        expect(source).not.toContain('<Suspense');
    });

    /**
     * 계약이 지켜졌을 때 실제 마크업이 성립하는지도 함께 본다 — 스코프를 넣고도
     * `aria-controls`와 `id`가 어긋나면 소용이 없다.
     */
    it('모든 aria-controls가 자기 nav 안의 실제 요소를 가리킨다', () => {
        const { container } = render(<HeaderNav items={NAV_TREE} />);

        const refs = [...container.querySelectorAll('[aria-controls]')];
        expect(refs.length).toBeGreaterThanOrEqual(2);
        for (const el of refs) {
            const target = el.getAttribute('aria-controls') as string;
            const scope = el.closest('nav') as HTMLElement;
            expect(
                scope.querySelector(`#${CSS.escape(target)}`),
                `aria-controls="${target}"`
            ).not.toBeNull();
        }
    });
});
