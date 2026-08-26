import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { blankCssComments } from './support/sourceScan';

/**
 * `docs/conventions/DESIGN.md`가 이름을 대는 `--color-*`는 실재해야 한다.
 *
 * 이 가드가 생긴 이유: 문서가 **없는 토큰 8개를 규약으로 안내하고 있었다.**
 * "토큰 2계층" 표의 2계층 행이 `surface` / `fg` / `accent` / `border-subtle`을
 * 열거하며 "신규·재작성 코드는 이것만 쓴다"고 적어 두었는데, 그 토큰들은
 * 소비자가 0이라 리디자인에서 통째로 삭제된 뒤였다. 사용처 예시에도
 * `bg-surface-page` · `text-fg-muted` 같은 죽은 이름이 괄호로 달려 있었다.
 *
 * 코드 쪽 짝인 [[deadColourTokenGuard]]는 **css → 코드** 방향만 본다(정의된
 * 토큰에 소비자가 있는가). 그 가드가 있었기에 죽은 토큰이 지워졌지만, 지워진
 * 사실이 문서에 반영됐는지는 아무도 검사하지 않았다. 방향이 반대인 이 구멍으로
 * 문서만 남아 다음 사람에게 존재하지 않는 규약을 가리켰다.
 *
 * 값까지 대조하지는 않는다. 문서에는 대비 실측치가 주석으로 함께 적혀 있어
 * 값 동기화를 기계로 강제하면 그 서술이 먼저 깨진다. **이름의 실재**만 붙든다 —
 * 거짓 안내의 대부분이 "지워진 이름을 계속 부르는" 형태였기 때문이다.
 */

const ROOT = path.resolve(__dirname, '../../..');
const DESIGN_DOC = path.join(ROOT, 'docs/conventions/DESIGN.md');
const GLOBALS_CSS = path.join(ROOT, 'src/app/globals.css');

/** 문서가 이 아래로 떨어지면 파서가 깨진 것이지 문서가 준 게 아니다. */
const MIN_MENTIONS = 15;

function definedTokens(): ReadonlySet<string> {
    const css = blankCssComments(readFileSync(GLOBALS_CSS, 'utf8'));
    return new Set(
        [...css.matchAll(/^\s*(--color-[a-z0-9-]+)\s*:/gm)].map(m => m[1]!)
    );
}

function mentionedTokens(): string[] {
    const doc = readFileSync(DESIGN_DOC, 'utf8');
    return [
        ...new Set(
            [...doc.matchAll(/--color-[a-z0-9-]+/g)]
                .map(m => m[0])
                // `--color-<name>`처럼 이름 자리를 비운 서술형 언급은 대상이 아니다.
                .filter(token => token.length > '--color-'.length)
        ),
    ].sort();
}

describe('design doc token guard', () => {
    it('DESIGN.md가 대는 토큰 이름이 전부 globals.css에 있다', () => {
        const mentions = mentionedTokens();
        expect(mentions.length).toBeGreaterThanOrEqual(MIN_MENTIONS);

        const defined = definedTokens();
        expect(mentions.filter(token => !defined.has(token))).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        const defined = definedTokens();
        // 리디자인에서 지워진 이름들 — 문서에 다시 등장하면 걸려야 한다.
        for (const dead of [
            '--color-surface',
            '--color-fg-muted',
            '--color-accent-fill',
            '--color-border-subtle',
        ]) {
            expect(defined.has(dead)).toBe(false);
        }
        // 살아 있는 이름은 통과한다.
        expect(defined.has('--color-border-control')).toBe(true);
        expect(defined.has('--color-secondary-800')).toBe(true);
    });
});
