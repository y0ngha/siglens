import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `border-control`이 **자기가 얹히는 모든 표면**에서 3:1을 지키는지 본다.
 *
 * 왜 있나: `controlBorderTokenGuard`는 "컨트롤이 장식 토큰을 쓰는가"만 본다.
 * `border-control`을 쓰기만 하면 통과하므로, 그 토큰이 그 자리에서 실제로
 * 유효한지는 아무도 확인하지 않았다. 그 구멍으로 결함이 들어왔다: 라이트
 * `border-control`을 카드 표면(`secondary-800`) 하나로만 재고 "3.30:1"이라
 * 적었는데, 입력 필드는 인셋(`secondary-950`) 위에 앉아 2.90:1이었고 그
 * 조합이 입력 계열 8개 파일에 퍼져 있었다. **한 표면에서 통과한 것이 토큰
 * 전체가 통과한 것은 아니다.** 이 가드는 딱 그 유형만 막는다.
 *
 * 사용처별로 `border-*`와 `bg-*`를 짝지어 재는 방식은 **일부러 버렸다.**
 * 같은 요소에 적힌 `bg-*`는 보더 **안쪽** 채움이고, 보더가 대비해야 하는 면은
 * 보통 부모 표면이라 정적으로는 이어지지 않는다. 그 전제로 짜봤더니 토글 썸
 * (흰 썸이 트랙과 대비되도록 보더를 두른 구조)과 `hover:bg-*` 채움이 그대로
 * 오탐으로 잡혔다. 기하가 애매한 자리는 브라우저 대비 스윕이 canvas로 합성색을
 * 풀어 실측한다 — 근거는 거기에 있고, 이 파일은 회귀 그물일 뿐이다.
 */

const GLOBALS_CSS = path.resolve(__dirname, '../../app/globals.css');
const MIN_RATIO = 3;

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

/**
 * `--color-*` 선언을 **전부** 잡는다. hex만 매칭하고 나머지를 조용히 건너뛰면,
 * 라이트 블록의 토큰 하나를 `oklch(...)`나 `white`로 적는 평범한 편집이 그
 * 토큰을 목록에서 지워버리고 — `light`는 `dark`를 상속하므로 — 가드가 **다크
 * 값을 라이트 표면에 대고 재면서 초록을 낸다.** 감사가 두 형태 모두로 재현했다.
 * 모르는 형식은 통과가 아니라 큰 실패여야 한다.
 */
function tokenValues(block: string): Map<string, string> {
    const out = new Map<string, string>();
    // 마지막 선언은 `;`가 없을 수 있다. `;`를 강제하면 그 줄이 **조용히
    // 목록에서 빠지고**, `light`가 `dark`를 복사해 시작하므로 가드가 다크 값을
    // 라이트 표면에 대고 재며 초록을 낸다 — 감사가 실제 2.89:1 위반을 그렇게
    // 숨겼다. 종결자 없이도 블록 끝까지 읽는다.
    for (const m of block.matchAll(
        /(--color-[\w-]+)\s*:\s*([^;}]+)(?:;|\s*$)/g
    )) {
        const value = m[2].trim();
        if (!/^#[0-9a-fA-F]{3,8}$/.test(value)) {
            throw new Error(
                `${m[1]}: 이 가드가 읽을 수 없는 색 형식 "${value}" — hex로 적거나 이 파서를 함께 고칠 것`
            );
        }
        out.set(m[1], value);
    }
    return out;
}

function readThemes(): {
    dark: Map<string, string>;
    light: Map<string, string>;
} {
    const source = readFileSync(GLOBALS_CSS, 'utf8');
    const themeOpen = /@theme\s*\{/.exec(source);
    const lightOpen = /:root\[data-theme='light'\]\s*\{/.exec(source);
    if (themeOpen === null || lightOpen === null) {
        throw new Error('globals.css: @theme or light block not found');
    }
    const dark = tokenValues(
        blockAt(source, themeOpen.index + themeOpen[0].length - 1)
    );
    const light = new Map(dark);
    for (const [k, v] of tokenValues(
        blockAt(source, lightOpen.index + lightOpen[0].length - 1)
    )) {
        light.set(k, v);
    }
    return { dark, light };
}

function relativeLuminance(hex: string): number {
    let h = hex.slice(1);
    if (h.length === 3) h = [...h].map(c => c + c).join('');
    // 길이를 여기서 막지 않으면 알파 hex(`#fff8`) 하나가 이 가드를 통째로
    // 무력화한다: `slice`가 채널 하나를 깨고 → `parseInt`가 NaN →
    // `NaN < MIN_RATIO`가 **false**라 실패가 배열에 안 담긴다. 즉 진짜 위반이
    // 조용히 통과한다. 이 파일의 존재 이유가 미래의 토큰 회귀를 잡는 것이므로
    // 모르는 형식은 통과가 아니라 큰 실패여야 한다.
    if (h.length !== 6) {
        throw new Error(`지원하지 않는 hex 형식: ${hex} (3·6자리만)`);
    }
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c: number) =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: string, b: string): number {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
        (x, y) => y - x
    );
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * 표면 램프. globals.css의 디자인 주석이 정한 세 층이다
 * (950 인셋(입력·차트 우물) / 900 본문 / 800 카드).
 */
const SURFACE_TOKENS = [
    '--color-secondary-950',
    '--color-secondary-900',
    '--color-secondary-800',
] as const;

const TOGGLE = path.resolve(
    __dirname,
    '../../features/reasoning-toggle/ui/ReasoningToggle.tsx'
);

/**
 * 토글의 트랙·썸 색을 **컴포넌트에서 읽어온다.**
 *
 * 예전엔 이 표를 손으로 적어뒀는데, 감사가 그게 무의미하다는 걸 증명했다:
 * 트랙을 `bg-secondary-700` → `bg-secondary-600`으로 바꾸면 라이트 off가
 * 2.54:1로 실제 1.4.11 위반이 되는데도 43개 테스트가 전부 초록이었다.
 * 가드가 제품에 **없는 상태 조합**을 재고 있었던 것이다. 이제 소스에서
 * 못 읽으면 통과가 아니라 실패한다.
 */
function toggleStates(): { name: string; track: string; thumb: string }[] {
    const source = readFileSync(TOGGLE, 'utf8');
    const pick = (re: RegExp, what: string): string => {
        const m = re.exec(source);
        if (m === null) {
            throw new Error(
                `ReasoningToggle에서 ${what}를 못 읽었다 — 클래스 구조가 바뀌었으면 이 가드를 함께 고칠 것`
            );
        }
        return m[1];
    };
    const token = (cls: string): string => `--color-${cls.replace(/^bg-/, '')}`;
    const on = pick(/effectiveChecked \? '(bg-[\w-]+)'/, '켜짐 트랙');
    const off = pick(
        /effectiveChecked \? 'bg-[\w-]+' : '(bg-[\w-]+)'/,
        '꺼짐 트랙'
    );
    const lockedTrack = pick(
        /locked && !disabled && '(bg-[\w-]+)'/,
        '잠김 트랙'
    );
    const lockedThumb = pick(/locked && !disabled \? '(bg-[\w-]+)'/, '잠김 썸');
    const thumb = pick(
        /locked && !disabled \? 'bg-[\w-]+' : '(bg-[\w-]+)'/,
        '기본 썸'
    );
    const asColour = (cls: string): string =>
        cls === 'bg-white' ? '#ffffff' : token(cls);
    return [
        { name: 'off', track: token(off), thumb: asColour(thumb) },
        { name: 'on', track: token(on), thumb: asColour(thumb) },
        {
            name: 'locked',
            track: token(lockedTrack),
            thumb: asColour(lockedThumb),
        },
    ];
}

describe('control border contrast', () => {
    it('border-control은 표면 램프 전체에서 두 테마 모두 3:1을 넘는다', () => {
        const themes = readThemes();
        const failures: string[] = [];
        for (const theme of ['dark', 'light'] as const) {
            const tokens = themes[theme];
            const border = tokens.get('--color-border-control');
            expect(border, `${theme} border-control 미정의`).toBeDefined();
            for (const surface of SURFACE_TOKENS) {
                const value = tokens.get(surface);
                expect(value, `${theme} ${surface} 미정의`).toBeDefined();
                const ratio = contrast(border as string, value as string);
                if (ratio < MIN_RATIO) {
                    failures.push(`${theme} ${surface} ${ratio.toFixed(2)}:1`);
                }
            }
        }
        expect(failures).toEqual([]);
    });

    /**
     * 토글 스위치는 램프 밖 표면 위에 앉는 유일한 `border-control` 사용처다 —
     * 썸이 **트랙** 위에 놓이고, 트랙은 상태마다 `secondary-700`(off) /
     * `primary-600`(on) / `secondary-800`(locked)으로 바뀐다. `secondary-700`은
     * 표면 램프에 없다(장식 보더 겸 hover 채움 토큰이라 뺐다).
     *
     * 이 자리를 램프에 넣어 일괄 처리하지 않는 이유: 다크 off에서 보더-트랙이
     * 2.67:1이지만 **위반이 아니다.** 그 상태에선 흰 썸이 트랙과 14.21:1로
     * 대비돼 썸을 식별하는 건 채움이지 보더가 아니다. 거꾸로 라이트 off는
     * 흰 썸이 흰 트랙에 1.23:1로 사라져 **보더만이** 썸을 식별하며, 그 값이
     * 3.10:1로 시스템 전체에서 가장 빠듯하다.
     *
     * 그래서 검사할 불변식은 토큰 하나가 아니라 상태별로
     * `max(썸채움-트랙, 보더-트랙) >= 3` 이다. 이 그물이 없으면 채움 쪽 안전망
     * (문서에 없던)이 사라지거나 보더 값이 "3.34가 바닥"이라는 잘못된 전제로
     * 조정될 때 아무도 못 잡는다. 라운드 5 리뷰가 잡아낸 구멍이 정확히 이것이다.
     */
    it('토글은 모든 상태에서 썸이 트랙과 3:1로 식별된다', () => {
        const themes = readThemes();
        const states = toggleStates();

        const failures: string[] = [];
        for (const theme of ['dark', 'light'] as const) {
            const tokens = themes[theme];
            const border = tokens.get('--color-border-control') as string;
            for (const state of states) {
                const track = tokens.get(state.track) as string;
                const thumb = state.thumb.startsWith('#')
                    ? state.thumb
                    : (tokens.get(state.thumb) as string);
                expect(track, `${theme} ${state.track} 미정의`).toBeDefined();
                expect(thumb, `${theme} ${state.thumb} 미정의`).toBeDefined();
                const identifiable = Math.max(
                    contrast(thumb, track),
                    contrast(border, track)
                );
                if (identifiable < MIN_RATIO) {
                    failures.push(
                        `${theme} ${state.name} ${identifiable.toFixed(2)}:1`
                    );
                }
            }
        }
        expect(failures).toEqual([]);
    });

    it('대비 계산이 알려진 값과 맞는다', () => {
        expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 5);
        expect(contrast('#7d838f', '#eff0f3')).toBeCloseTo(3.341, 3);
        // 이 값이 결함을 낳았다 — 옛 라이트 토큰이 인셋 표면에서 3:1 미달.
        expect(contrast('#878e9a', '#eff0f3')).toBeCloseTo(2.895, 3);
        // 시스템에서 가장 빠듯한 자리(라이트 off 토글: 보더 대 트랙).
        expect(contrast('#7d838f', '#e6e8ec')).toBeCloseTo(3.104, 3);
    });
});
