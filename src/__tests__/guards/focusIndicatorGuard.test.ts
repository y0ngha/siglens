import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { blankCssComments } from './support/sourceScan';
import { minContrastOverSurfaces, MIN_RATIO } from './support/tokenContrast';

/**
 * 포커스 표시(WCAG 2.4.7 / 1.4.11)를 **소스에서** 붙든다.
 *
 * 왜 유닛 테스트가 아니라 가드인가: 이 세 결함은 전부 **CSS 캐스케이드**
 * 속성이라 jsdom이 볼 수 없다. 감사가 셋을 각각 되돌렸을 때 테스트가 전부
 * 초록이었다 — 즉 고쳐놓고도 아무 게이트가 지키지 않는 상태였다.
 *
 * 실제로 있었던 결함 셋:
 *
 *  1. `.focus-glow`가 `@layer` 밖에 선언돼 Tailwind utilities 레이어의
 *     `focus:ring-1`을 통째로 이겼다. 포커스 표시가 흐릿한 번짐만 남아
 *     다크 1.32:1 · 라이트 1.62:1이었다(같은 컴포넌트의 작은 변형은 링이
 *     살아 있어 5.38:1로 통과 — 큰 변형만 조용히 깨져 있었다).
 *  2. 인증 폼 입력이 `ring-primary-500/40`이라 카드 위에서 1.78 · 1.96:1.
 *     같은 폼의 제출 버튼은 불투명 링이라 통과하고 있었다.
 *  3. 경제 달력에서 **선택된 날**은 표시가 `ring-primary-500 ring-2`인데
 *     포커스 스타일도 같은 값이라, 그 셀만 포커스 전후 계산값이 바이트
 *     동일해 표시가 아예 없었다(다른 21개 날짜는 정상).
 */

const SRC_DIR = path.resolve(__dirname, '../..');
const GLOBALS_CSS = path.join(SRC_DIR, 'app/globals.css');

const read = (rel: string): string =>
    readFileSync(path.join(SRC_DIR, rel), 'utf8');

describe('focus indicator guard', () => {
    /**
     * 글로우는 링을 **보완**해야지 대체하면 안 된다. 링 레이어(퍼짐 있는
     * 0-blur 그림자)가 `box-shadow`에 함께 있는지 본다.
     */
    it('.focus-glow가 링을 함께 그린다', () => {
        const css = blankCssComments(read('app/globals.css'));
        const at = css.indexOf('.focus-glow:focus-visible');
        expect(
            at,
            `.focus-glow 규칙을 못 찾음 (${GLOBALS_CSS})`
        ).toBeGreaterThan(-1);
        const block = css.slice(at, css.indexOf('}', at));
        // 링 레이어: blur 0 + 양의 spread. 글로우만 있으면 `0 0 20px`뿐이다.
        expect(block, '글로우만 있고 링 레이어가 없다').toMatch(
            /0\s+0\s+0\s+\d+px/
        );
    });

    /**
     * 포커스 링에 알파를 붙이면 표면 위에서 3:1을 못 넘긴다. 토큰 값이 아니라
     * **합성 후** 대비를 재므로, 나중에 토큰이 바뀌어도 규칙이 살아 있다.
     */
    it.each([
        'shared/ui/auth/AuthFieldGroup.tsx',
        'shared/ui/auth/PasswordField.tsx',
    ])('%s의 포커스 링이 3:1을 넘는다', rel => {
        const source = read(rel);
        const rings = [
            ...source.matchAll(/focus:ring-([a-z][\w-]*(?:\/\d+)?)/g),
        ]
            .map(m => m[1])
            // `ring-2` 같은 두께 유틸리티는 색이 아니다.
            .filter(v => !/^\d+$/.test(v));
        expect(rings.length, '포커스 링 색을 못 찾음').toBeGreaterThan(0);
        for (const ring of rings) {
            expect(
                minContrastOverSurfaces(ring, 'either'),
                `${rel}: focus:ring-${ring}`
            ).toBeGreaterThanOrEqual(MIN_RATIO);
        }
    });

    /**
     * 건너뛰기 링크의 **대상이 포커스를 받을 수 있어야** 한다. 없으면 링크가
     * 해시만 바꾸고 DOM 포커스는 `body`에 남아, 링크가 적어둔 일을 하지 않는다
     * (실측으로 확인된 상태였다).
     */
    it('건너뛰기 링크의 대상이 포커스를 받는다', () => {
        // 홈은 로케일 세그먼트 아래로 옮겼다(`/`도 `[locale]`이 처리한다).
        const source = read('app/[locale]/(home)/page.tsx');
        const href = /<a\s+href="#([\w-]+)"/.exec(source);
        expect(href, '건너뛰기 링크를 못 찾음').not.toBeNull();
        const id = (href as RegExpExecArray)[1];
        const target = new RegExp(
            `id="${id}"[\\s\\S]{0,200}?tabIndex=\\{-1\\}`
        );
        expect(source, `#${id} 대상에 tabIndex={-1}이 없다`).toMatch(target);
    });

    /**
     * 선택 표시와 포커스 표시가 **같은 값이면** 선택된 요소에서 포커스가
     * 사라진다. 달력 셀이 선택 상태에 `ring-2`를 쓰므로, 포커스 쪽에는
     * `ring-offset`이 있어야 둘이 갈린다.
     */
    it('달력 셀의 선택 표시와 포커스 표시가 구분된다', () => {
        const source = read(
            'widgets/economy/sections/EconomicCalendarGrid.tsx'
        );
        const selected = /ring-primary-500 ring-2/.test(source);
        expect(selected, '선택 표시가 바뀌었다면 이 가드도 함께 볼 것').toBe(
            true
        );
        expect(source).toMatch(/focus-visible:ring-offset-\d/);
        expect(source).toMatch(/focus-visible:ring-offset-[a-z]/);
    });
});
