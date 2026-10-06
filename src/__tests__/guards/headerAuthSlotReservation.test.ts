import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AUTH_HINT_INIT_SCRIPT } from '@/shared/lib/auth/authHintAttribute';
import en from '../../../messages/en.json';
import ja from '../../../messages/ja.json';
import ko from '../../../messages/ko.json';
import zh from '../../../messages/zh.json';

/**
 * **헤더 인증 영역 폭 예약** — `globals.css`의 `[data-header-auth-slot]` 규칙.
 *
 * 정적 셸 헤더는 서버에서 늘 게스트 CTA를 그리고 회원은 하이드레이션 뒤 아바타로 바뀐다.
 * 첫 페인트 전 스크립트가 `<html data-auth-hint>`를 찍고, CSS가 그 값으로 폭을 미리 잡아
 * 교체 때 헤더가 밀리지 않게 한다(CLS). 이 가드는 그 계약의 세 조각을 고정한다:
 * 폭 선언이 `min-width`뿐인지, 게스트 폭이 가장 넓은 CTA를 담는지, 두 레이아웃이 스크립트를
 * 싣는지.
 */
const ROOT = path.resolve(__dirname, '../../..');
/** 주석은 걷어 낸다 — 근거 주석이 선택자 이름을 그대로 적는다. */
const CSS = readFileSync(
    path.join(ROOT, 'src/app/globals.css'),
    'utf8'
).replace(/\/\*[\s\S]*?\*\//g, '');

const REM_PX = 16;
/** `sm` 브레이크포인트(40rem) 이상에서만 예약한다 — 그 아래는 CTA가 숨는다. */
const SM_MEDIA = '@media (width >= 40rem)';

/** `[data-header-auth-slot]`을 선택자에 가진 규칙의 본문들. */
function slotRuleBodies(css: string): string[] {
    return [
        ...css.matchAll(/([^{}]*\[data-header-auth-slot\][^{}]*)\{([^}]*)\}/g),
    ].map(match => match[2]);
}

function minWidthRem(body: string): number {
    const match = body.match(/min-width:\s*([\d.]+)rem/);
    if (match === null) throw new Error(`min-width rem not found in: ${body}`);
    return Number(match[1]);
}

describe('[data-header-auth-slot] CSS', () => {
    const bodies = slotRuleBodies(CSS);

    it('게스트·회원 두 규칙이 있다', () => {
        expect(bodies).toHaveLength(2);
    });

    /** `width`/`max-width`로 고정하면 예상보다 넓은 CTA(새 로케일·큰 글꼴)가 잘린다. */
    it('폭은 min-width로만 선언한다', () => {
        for (const body of bodies) {
            const properties = [...body.matchAll(/([\w-]+)\s*:/g)].map(
                m => m[1]
            );
            expect(properties).toEqual(['min-width']);
        }
    });

    it('두 규칙 모두 sm 이상 미디어 쿼리 하나 안에 있다', () => {
        const firstSlot = CSS.indexOf('[data-header-auth-slot]');
        const lastSlot = CSS.lastIndexOf('[data-header-auth-slot]');
        const mediaStart = CSS.lastIndexOf(SM_MEDIA, firstSlot);
        expect(mediaStart).toBeGreaterThan(-1);
        // 미디어 블록이 첫 규칙 전에 닫히지 않고, 마지막 규칙 뒤에서 닫힌다.
        expect(CSS.slice(mediaStart, firstSlot)).not.toContain('\n}\n');
        expect(lastSlot).toBeLessThan(CSS.indexOf('\n}\n', mediaStart));
    });

    it('회원 추정 폭은 아바타·스켈레톤(size-10 = 2.5rem)과 같다', () => {
        const member = CSS.match(
            /:root\[data-auth-hint='member'\] \[data-header-auth-slot\]\s*\{([^}]*)\}/
        );
        expect(member).not.toBeNull();
        expect(minWidthRem(member?.[1] ?? '')).toBe(2.5);
    });

    it('회원 추정이면 게스트 CTA를 첫 페인트부터 숨긴다', () => {
        expect(CSS).toMatch(
            /:root\[data-auth-hint='member'\] \[data-header-guest-cta\]\s*\{\s*display:\s*none;\s*\}/
        );
    });
});

/**
 * 게스트 폭이 **가장 넓은 CTA**(현재 ja `ログイン`+`会員登録`)를 담는지.
 *
 * jsdom엔 레이아웃이 없어 글자 폭을 보수적으로 추정한다: `text-sm`(14px)에서 CJK 글자는 전각
 * 1em, 라틴 글자는 평균 0.6em(Pretendard·Inter 실측 평균은 0.5~0.55em). 버튼은 `px-3`(좌우
 * 0.75rem)씩, 둘 사이는 `gap-2`(0.5rem). 추정이 예약 폭을 넘으면 새 로케일이나 문구 변경이
 * 예약을 깨뜨린 것이다 — 폭을 늘리거나 문구를 줄인다.
 */
describe('게스트 CTA가 예약 폭 안에 들어간다', () => {
    const TEXT_SM_PX = 14;
    const CJK_EM = 1;
    const LATIN_EM = 0.6;
    const BUTTON_PADDING_PX = 2 * 0.75 * REM_PX;
    const GAP_PX = 0.5 * REM_PX;

    function textWidthPx(text: string): number {
        return [...text].reduce(
            (sum, ch) =>
                sum +
                TEXT_SM_PX * (/[　-鿿가-힯＀-￯]/.test(ch) ? CJK_EM : LATIN_EM),
            0
        );
    }

    function ctaWidthPx(catalog: typeof ko): number {
        const menu = catalog.widgets.layout.HeaderUserMenu;
        return (
            textWidthPx(menu.e225a6) +
            textWidthPx(menu.ecb4cc) +
            2 * BUTTON_PADDING_PX +
            GAP_PX
        );
    }

    const guestRule = CSS.match(/\{\s*\[data-header-auth-slot\]\s*\{([^}]*)\}/);
    const guestPx = minWidthRem(guestRule?.[1] ?? '') * REM_PX;

    it.each([
        ['ko', ko],
        ['en', en],
        ['ja', ja],
        ['zh', zh],
    ] as const)('%s', (_locale, catalog) => {
        expect(ctaWidthPx(catalog)).toBeLessThanOrEqual(guestPx);
    });

    it('예약 폭은 11rem이다', () => {
        expect(guestPx).toBe(11 * REM_PX);
    });
});

describe('첫 페인트 전 스크립트 탑재', () => {
    it.each(['src/app/[locale]/layout.tsx', 'src/app/ai/[locale]/layout.tsx'])(
        '%s가 AUTH_HINT_INIT_SCRIPT를 beforeInteractive로 싣는다',
        file => {
            const source = readFileSync(path.join(ROOT, file), 'utf8');
            expect(source).toMatch(
                /<Script\s+id="[\w-]*auth-hint-init"\s+strategy="beforeInteractive"\s+dangerouslySetInnerHTML=\{\{ __html: AUTH_HINT_INIT_SCRIPT \}\}/
            );
        }
    );

    it('스크립트는 <html data-auth-hint>를 찍는다', () => {
        expect(AUTH_HINT_INIT_SCRIPT).toContain('"data-auth-hint"');
    });
});
