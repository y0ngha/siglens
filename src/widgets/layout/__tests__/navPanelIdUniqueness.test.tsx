vi.mock('next/navigation', () => ({
    usePathname: vi.fn(() => '/market'),
}));

import { readFileSync } from 'node:fs';
import path from 'node:path';

import { render } from '@testing-library/react';
import { HeaderNav } from '../HeaderNav';
import { NAV_TREE } from '../headerNavTree';

/**
 * `HeaderNavStatic`(Suspense fallback)과 `HeaderNav`(본체)의 패널 id는 서로
 * 달라야 한다.
 *
 * 무엇이 깨졌었나: 둘 다 `HeaderNavMenu`를 렌더하고 같은 트리 위치에 있어
 * `useId()`가 **같은 값**을 발급했다. fallback은 스트리밍 후에도 문서에서
 * 제거되지 않고 숨겨질 뿐이라 같은 id가 두 번 남고, `getElementById`는 첫
 * 매치를 돌려주므로 **보이는 메뉴의 `aria-controls`가 숨겨진 fallback의 패널을
 * 가리켰다**. 실측(서빙 HTML `/news`): `aria-label="주요 네비게이션"` nav 2개,
 * 중복 id 4개, 각 id의 참조 2개. master도 동일했다(선재 결함).
 *
 * **왜 소스 가드인가.** 이 충돌은 렌더 테스트로 재현되지 않는다. 한 번의
 * `render()`에 형제로 넣으면 트리 위치가 갈려 id가 자연히 달라지고, 루트를
 * 나눠 두 번 렌더해도 `useId` 카운터가 전역이라 역시 갈린다 — 두 방법 모두
 * `idScope`를 지운 뮤테이션에서 초록이었다. 조건은 스트리밍 SSR에서만 성립하고
 * jsdom에는 그 경로가 없다. 그래서 이 파일은 실제로 결함을 막는 **계약**을
 * 직접 본다: 두 호출부가 서로 다른 `idScope`를 넘기는가.
 */

const LAYOUT_DIR = path.resolve(__dirname, '..');

/** `<HeaderNavMenu ... idScope="X"` 에서 X를 뽑는다. */
function idScopeIn(file: string): string | null {
    const source = readFileSync(path.join(LAYOUT_DIR, file), 'utf8');
    const at = source.indexOf('<HeaderNavMenu');
    if (at === -1) return null;
    const tag = source.slice(at, source.indexOf('/>', at));
    return /idScope="([^"]+)"/.exec(tag)?.[1] ?? null;
}

describe('nav 패널 id 유일성', () => {
    it('두 호출부가 서로 다른 idScope를 넘긴다', () => {
        const body = idScopeIn('HeaderNav.tsx');
        const fallback = idScopeIn('HeaderNavStatic.tsx');

        expect(body, 'HeaderNav가 idScope를 안 넘긴다').not.toBeNull();
        expect(
            fallback,
            'HeaderNavStatic이 idScope를 안 넘긴다'
        ).not.toBeNull();
        expect(body).not.toBe(fallback);
    });

    it('검출기가 실제로 잡는다', () => {
        // 두 파일 모두 `<HeaderNavMenu`를 정확히 하나씩 렌더한다는 전제 위에
        // 서 있다. 전제가 깨지면 위 검사가 조용히 무의미해지므로 함께 본다.
        for (const file of ['HeaderNav.tsx', 'HeaderNavStatic.tsx']) {
            const source = readFileSync(path.join(LAYOUT_DIR, file), 'utf8');
            expect(source.split('<HeaderNavMenu').length - 1, file).toBe(1);
        }
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
