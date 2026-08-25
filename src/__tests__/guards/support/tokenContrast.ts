import { readFileSync } from 'node:fs';
import path from 'node:path';

import { blankCssComments } from './sourceScan';

/**
 * 색 토큰의 **실제 값**으로 대비를 판정한다.
 *
 * 왜 이름이 아니라 값인가: 허용 목록을 `primary-*`·`chart-*` 같은 계열
 * 와일드카드로 적어뒀더니, 같은 계열 안에서 3:1을 한참 밑도는 토큰 10종이
 * 그대로 통과했다(`primary-950` 1.02, `chart-signal` 1.88 …). 계열은 대비를
 * 보장하지 않는다. 어떤 색이 경계로 쓸 만한지는 **재보면 알 수 있고**, 재는
 * 코드는 이미 대비 가드에 있었는데 옆 가드가 안 쓰고 있었다.
 */

const GLOBALS_CSS = path.resolve(__dirname, '../../../app/globals.css');

/** 컨트롤이 얹히는 표면 램프(인셋 950 / 본문 900 / 카드 800). */
const SURFACE_TOKENS = [
    '--color-secondary-950',
    '--color-secondary-900',
    '--color-secondary-800',
] as const;

/** `fixed-*` 토큰은 테마와 무관한 고정 표면 위에 산다(구글 브랜드 흰 버튼). */
const FIXED_SURFACE = '#ffffff';

export const MIN_RATIO = 3;

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

function declarations(block: string): Map<string, string> {
    const out = new Map<string, string>();
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

export interface Themes {
    dark: Map<string, string>;
    light: Map<string, string>;
}

/**
 * globals.css의 두 블록을 읽는다. **주석을 먼저 비운다** — 주석 속 `}` 하나에
 * 블록이 잘리면 라이트 맵이 다크 복사본으로 되돌아가고, 가드는 다크 값을
 * 라이트 표면에 대고 재면서 초록을 낸다. 같은 함수가 두 파일에 복제돼 있어
 * 한쪽만 고쳐진 적이 있어서, 여기 한 벌만 둔다.
 */
export function readThemes(): Themes {
    const source = blankCssComments(readFileSync(GLOBALS_CSS, 'utf8'));
    const themeOpen = /@theme\s*\{/.exec(source);
    const lightOpen = /:root\[data-theme='light'\]\s*\{/.exec(source);
    if (themeOpen === null || lightOpen === null) {
        throw new Error('globals.css: @theme or light block not found');
    }
    const dark = declarations(
        blockAt(source, themeOpen.index + themeOpen[0].length - 1)
    );
    const light = new Map(dark);
    for (const [k, v] of declarations(
        blockAt(source, lightOpen.index + lightOpen[0].length - 1)
    )) {
        light.set(k, v);
    }
    return { dark, light };
}

export function relativeLuminance(hex: string): number {
    let h = hex.slice(1);
    if (h.length === 3) h = [...h].map(c => c + c).join('');
    if (h.length !== 6) {
        throw new Error(`지원하지 않는 hex 형식: ${hex} (3·6자리만)`);
    }
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c: number): number =>
        c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
        (x, y) => y - x
    );
    return (hi + 0.05) / (lo + 0.05);
}

/** `secondary-700`, `primary-500/60` 같은 Tailwind 색 표기를 hex로. */
function resolve(
    colour: string,
    tokens: Map<string, string>
): { hex: string; alpha: number } | null {
    const [name, alphaPart] = colour.split('/');
    const hex = tokens.get(`--color-${name}`);
    if (hex === undefined) return null;
    const alpha = alphaPart === undefined ? 1 : Number(alphaPart) / 100;
    if (!Number.isFinite(alpha)) return null;
    return { hex, alpha };
}

function composite(fg: string, alpha: number, bg: string): string {
    const px = (h: string): number[] => {
        let s = h.slice(1);
        if (s.length === 3) s = [...s].map(c => c + c).join('');
        return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));
    };
    const [f, b] = [px(fg), px(bg)];
    const mixed = f.map((c, i) => Math.round(c * alpha + b[i] * (1 - alpha)));
    return `#${mixed.map(c => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * 그 색이 **모든 표면·양 테마에서** 최소 몇 대 1인가. 토큰을 못 읽으면 `null`.
 * 알파가 붙어 있으면 표면 위에 합성한 뒤 잰다 — 알파는 어떤 배경에서도 대비를
 * 낮추므로 이 계산이 곧 "틴트를 써도 되는가"의 답이 된다.
 */
/** 컨트롤이 어떤 면 위에 앉는가. 요소의 채움 클래스로 정한다. */
export type Fill = 'ramp' | 'fixed-white' | 'either';

export function minContrastOverSurfaces(
    colour: string,
    fill: Fill = 'ramp',
    themes: Themes = readThemes()
): number {
    let worst = Infinity;
    let resolvedAnywhere = false;
    for (const tokens of [themes.dark, themes.light]) {
        const resolved = resolve(colour, tokens);
        if (resolved === null) continue;
        resolvedAnywhere = true;
        // **표면을 토큰 이름으로 고르지 않는다.** 한때 `fixed-` 접두어를 보고
        // 흰 표면만 쟀는데, 그건 방금 걷어낸 계열 와일드카드와 같은 추론이고
        // 양방향으로 뚫렸다 — `fixed-light-border`를 테마 컨트롤에 쓰면 흰 배경
        // 기준 3.02로 통과하지만 라이트 램프에서는 2.65였고, 반대로 램프 토큰을
        // 항상-흰 버튼에 쓰면 램프 기준 6.89로 통과하지만 흰 배경에서는 2.26이었다.
        // 이제 **호출부가 요소의 채움을 보고** 어느 면인지 알려준다.
        // `either`는 **둘 다 재고 최솟값**을 쓴다. 파일 안에 고정 흰 면과 램프 면이
        // 섞여 있으면 어느 쪽에 앉는지 소스만으로 못 가리는데, 한쪽만 재면 그
        // 방향이 관대할 수 있다 — 실제로 흰 면이 `primary-800`에는 8.72로 후하고
        // 램프에서는 2.18이라, 흰 면 기준으로 재면 위반이 사라진다.
        const surfaces =
            fill === 'fixed-white'
                ? [FIXED_SURFACE]
                : fill === 'either'
                  ? [...SURFACE_TOKENS.map(s => tokens.get(s)), FIXED_SURFACE]
                  : SURFACE_TOKENS.map(s => tokens.get(s));
        for (const surface of surfaces) {
            if (surface === undefined) continue;
            const over = composite(resolved.hex, resolved.alpha, surface);
            worst = Math.min(worst, contrast(over, surface));
        }
    }
    if (!resolvedAnywhere) {
        // **모르는 색은 통과가 아니라 실패다.** 예전엔 `null`을 돌려줬고
        // 호출부가 그걸 "장식 아님 = 합격"으로 접었다. 그래서 Tailwind 기본
        // 팔레트(`border-white`, `border-red-500`)와 임의값(`border-[#2b2f36]`)이
        // 전부 무검사 통과했다 — 흰 버튼 위의 `border-white`는 1.00:1이다.
        // 이 파일은 hex 형식에 대해서는 이미 이 원칙을 지키고 있었다.
        throw new Error(
            `${colour}: globals.css에 없는 색이라 대비를 잴 수 없다 — 토큰을 쓰거나 실측값과 함께 예외로 명시할 것`
        );
    }
    return worst;
}
