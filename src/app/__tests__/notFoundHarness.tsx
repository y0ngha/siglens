import { act, render } from '@testing-library/react';
import { vi } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { NotFoundLayout } from '@/app/_components/NotFoundLayout';
import { NotFoundView } from '@/app/_components/NotFoundView';
import { buildOverrides } from '@/app/_components/notFoundOverrides';
import RootNotFound from '../not-found';

/**
 * 루트 404 테스트 공용 하네스. 서버 컴포넌트(`RootNotFound`)는 `await`로 요소 트리를 만든다 —
 * 정적이라 요청 API 목이 필요 없다.
 */
export async function renderRoot() {
    const ui = await RootNotFound();
    let result!: ReturnType<typeof render>;
    await act(async () => {
        result = render(ui);
    });
    return result;
}

export function visit(path: string): void {
    window.history.pushState({}, '', path);
}

/**
 * `<title>`은 React가 소유한 호이스터블이다 — `document.title = ''`는 없던 `<title>`을 만든다.
 * 하이드레이션 테스트는 루트를 언마운트하지 않으므로 직접 걷어야 한다.
 */
export function removeTitles(): void {
    document.querySelectorAll('title').forEach(title => title.remove());
}

export interface HydrationOutcome {
    readonly recoverableErrors: unknown[];
    readonly consoleErrors: unknown[][];
    readonly container: HTMLElement;
}

async function islandElement() {
    return (
        <NotFoundView overrides={await buildOverrides()}>
            <NotFoundLayout
                wordmark="Siglens"
                homeHref="/"
                documentTitle="페이지를 찾을 수 없습니다 | Siglens"
                title="페이지를 찾을 수 없습니다"
                homeLabel="홈"
            />
        </NotFoundView>
    );
}

/**
 * 서버 마크업(`renderToString` — 기본 스냅샷, 한국어 · 메인 호스트)을 컨테이너에 심고,
 * `clientPath`(기본: 현재 주소)로 `hydrateRoot`한다. 하이드레이션 불일치는
 * `onRecoverableError`와 `console.error`로 새어 나오므로 둘 다 모은다.
 */
export async function hydrateServerMarkup(
    serverPath = '/',
    clientPath = window.location.pathname
): Promise<HydrationOutcome> {
    const view = await islandElement();
    const container = document.createElement('div');
    document.body.appendChild(container);
    // 서버는 요청 주소를 모른다 — 서버 렌더는 늘 기본 주소로 한 것처럼 만든 뒤, 클라이언트
    // 주소로 되돌려 하이드레이션한다. 서버 스냅샷이 주소를 읽으면 여기서 불일치가 난다.
    visit(serverPath);
    container.innerHTML = renderToString(view);
    visit(clientPath);
    const recoverableErrors: unknown[] = [];
    const consoleErrors: unknown[][] = [];
    const spy = vi
        .spyOn(console, 'error')
        .mockImplementation((...args: unknown[]) => {
            consoleErrors.push(args);
        });
    try {
        await act(async () => {
            hydrateRoot(container, view, {
                onRecoverableError: error => recoverableErrors.push(error),
            });
        });
    } finally {
        spy.mockRestore();
    }
    return { recoverableErrors, consoleErrors, container };
}
