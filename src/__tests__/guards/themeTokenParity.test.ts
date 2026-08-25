import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { blankComments } from './support/sourceScan';

/**
 * 라이트 테마 블록이 정의하는 모든 `--color-*`는 다크(`@theme`)에도 있어야 한다.
 *
 * 이 불변식이 깨지는 방식은 조용하다. 라이트 블록에 토큰 이름을 **오타**로 쓰면
 * (`--color-ui-sucess-text`) CSS는 그냥 새 커스텀 프로퍼티를 하나 만들고, 진짜
 * 토큰은 다크 값을 그대로 유지한다. 빌드도 lint도 통과하고, 라이트 테마에서만
 * 다크용 색이 남는다 — 화면을 직접 보기 전에는 아무 신호가 없다.
 *
 * 반대 방향(다크에는 있는데 라이트 오버라이드가 없음)은 **정상이다**. 지표 색처럼
 * 두 테마 공통인 값이 다수이고, `chartColors.ts`가 "지표 색은 정체성이라 두
 * 테마에서 동일하다"고 명시한다. 그래서 이 가드는 한 방향만 본다.
 *
 * 색이 실제로 읽히는지(대비)는 이 가드가 아니라 라우트별 대비 스윕이 본다.
 * 여기서 잡는 건 **배선 실수**다.
 */

const GLOBALS_CSS = path.resolve(__dirname, '../../app/globals.css');

/** 여는 중괄호 위치에서 시작해 균형이 맞는 지점까지의 블록 본문. */
function blockAt(source: string, openBraceIndex: number): string {
    let depth = 0;
    for (let i = openBraceIndex; i < source.length; i += 1) {
        if (source[i] === '{') depth += 1;
        else if (source[i] === '}') {
            depth -= 1;
            if (depth === 0) return source.slice(openBraceIndex, i);
        }
    }
    throw new Error('unbalanced braces in globals.css');
}

function colourTokens(block: string): Set<string> {
    return new Set([...block.matchAll(/(--color-[\w-]+)\s*:/g)].map(m => m[1]));
}

function readThemeBlocks(): { dark: Set<string>; light: Set<string> } {
    // **주석을 먼저 비운다.** 쌍둥이 가드에서 같은 결함을 고쳤는데 이 파일은
    // 그대로였다 — 주석 속 `}` 하나면 라이트 블록이 잘리고, 그러면 뒤쪽
    // 오버라이드가 통째로 목록에서 빠져 오타 토큰이 검출되지 않는다.
    const source = blankComments(readFileSync(GLOBALS_CSS, 'utf8'));
    const themeOpen = /@theme\s*\{/.exec(source);
    const lightOpen = /:root\[data-theme='light'\]\s*\{/.exec(source);
    if (themeOpen === null || lightOpen === null) {
        throw new Error('globals.css: @theme or light block not found');
    }
    return {
        dark: colourTokens(
            blockAt(source, themeOpen.index + themeOpen[0].length - 1)
        ),
        light: colourTokens(
            blockAt(source, lightOpen.index + lightOpen[0].length - 1)
        ),
    };
}

describe('theme token parity', () => {
    it('라이트가 오버라이드하는 토큰은 모두 다크에 정의돼 있다', () => {
        const { dark, light } = readThemeBlocks();
        const orphans = [...light].filter(token => !dark.has(token)).sort();
        expect(orphans).toEqual([]);
    });

    it('두 블록 다 실제로 토큰을 담고 있다 — 파서가 빈 집합을 반환하면 위 검사가 무의미하다', () => {
        const { dark, light } = readThemeBlocks();
        expect(dark.size).toBeGreaterThan(50);
        expect(light.size).toBeGreaterThan(20);
    });

    it('오타 난 오버라이드를 실제로 잡는다', () => {
        const dark = new Set(['--color-ui-success-text']);
        const light = new Set(['--color-ui-sucess-text']);
        const orphans = [...light].filter(token => !dark.has(token));
        expect(orphans).toEqual(['--color-ui-sucess-text']);
    });
});
