import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { sourceFiles } from './support/controlUsage';
import { blankCssComments } from './support/sourceScan';

/**
 * `globals.css`가 정의하는 모든 `--color-*`에 실제 소비자가 있어야 한다.
 *
 * 왜 필요한가: 같은 결함이 이 브랜치에서 **두 번** 나왔고, 두 번째는 규모가
 * 컸다. 처음에는 `--color-chart-neutral` 하나가 아무 데서도 안 쓰인 채 남아
 * 있었다. 그걸 지운 뒤에도 `@theme inline`의 시맨틱 계층 **14개 전부**가
 * 소비자 0인 상태로 남아 있었는데, 그 블록의 주석은 하필
 * "신규·재작성 코드는 이것만 쓴다"였다 — 페이지 30여 개를 재작성하면서
 * 하나도 쓰지 않았으므로, 주석이 코드가 하지 않는 보장을 약속하고 있었다.
 *
 * 죽은 토큰이 나쁜 이유는 용량이 아니라 **거짓 안내**다. 다음 사람은 이름만
 * 보고 그게 이 코드베이스의 규약이라고 읽는다. 게다가 어떤 대비 가드도
 * 그 값을 검사하지 않으므로(가드는 실제 사용된 유틸리티를 훑는다) 접근성
 * 미달인 값이 규약처럼 보이는 자리에 조용히 앉아 있게 된다.
 *
 * 소비자 판정은 **느슨하게** 잡는다. 엄격하게 잡으면 `border-t-secondary-700`
 * 같은 변형에서 거짓 실패가 나고, 거짓 실패가 나는 가드는 곧 무력화된다.
 * 이 가드가 잡으려는 것은 "어디에도 언급조차 없는" 토큰뿐이다.
 */

const SRC_DIR = path.resolve(__dirname, '../..');
const GLOBALS_CSS = path.join(SRC_DIR, 'app/globals.css');

/**
 * 스캔이 파일을 하나도 안 열었을 때와 위반이 0건일 때의 출력이 같아지는 것을
 * 막는다. 토큰이 이 아래로 떨어지면 파서가 깨진 것이지 토큰이 준 게 아니다.
 */
const MIN_TOKENS = 40;

function definedTokens(): string[] {
    const css = blankCssComments(readFileSync(GLOBALS_CSS, 'utf8'));
    return [
        ...new Set(
            [...css.matchAll(/^\s*(--color-[a-z0-9-]+)\s*:/gm)].map(m => m[1])
        ),
    ].sort();
}

/** globals.css를 제외한 트리 전체 + globals.css 안의 `var()` 참조. */
function consumerText(): string {
    const css = blankCssComments(readFileSync(GLOBALS_CSS, 'utf8'));
    const parts = [...css.matchAll(/var\((--color-[a-z0-9-]+)/g)].map(
        m => m[1]
    );
    for (const file of sourceFiles(SRC_DIR)) {
        if (file === GLOBALS_CSS) continue;
        parts.push(readFileSync(file, 'utf8'));
    }
    return parts.join('\n');
}

function deadTokens(): string[] {
    const haystack = consumerText();
    return definedTokens().filter(token => {
        const name = token.slice('--color-'.length);
        // `bg-surface`, `border-t-secondary-700`, `var(--color-surface)`,
        // `text-[--color-fg]` — 어떤 형태든 이름이 등장하기만 하면 살아 있다.
        return !new RegExp(`[-(]${name}(?![a-z0-9-])`).test(haystack);
    });
}

describe('dead colour token guard', () => {
    it('정의된 모든 --color-*에 소비자가 있다', () => {
        expect(definedTokens().length).toBeGreaterThanOrEqual(MIN_TOKENS);
        expect(deadTokens()).toEqual([]);
    });

    it('검출기가 실제로 잡는다', () => {
        const haystack = 'bg-secondary-900 border-t-secondary-700';
        const alive = (name: string): boolean =>
            new RegExp(`[-(]${name}(?![a-z0-9-])`).test(haystack);
        expect(alive('secondary-900')).toBe(true);
        // 변형 접두사(`border-t-`)를 통과시킨다 — 거짓 실패의 주된 원인이었다.
        expect(alive('secondary-700')).toBe(true);
        // 접두사가 더 긴 토큰을 부분 일치로 살려주면 안 된다.
        expect(alive('secondary-90')).toBe(false);
        expect(alive('surface-page')).toBe(false);
    });
});
