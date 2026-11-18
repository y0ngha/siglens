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

    it('기본(게스트)·언어별 4개·회원 규칙이 있다', () => {
        expect(bodies).toHaveLength(6);
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

    it('모든 규칙이 sm 이상 미디어 쿼리 하나 안에 있다', () => {
        const firstSlot = CSS.indexOf('[data-header-auth-slot]');
        const lastSlot = CSS.lastIndexOf('[data-header-auth-slot]');
        const mediaStart = CSS.lastIndexOf(SM_MEDIA, firstSlot);
        expect(mediaStart).toBeGreaterThan(-1);
        // 미디어 블록이 첫 규칙 전에 닫히지 않고, 마지막 규칙 뒤에서 닫힌다.
        expect(CSS.slice(mediaStart, firstSlot)).not.toContain('\n}\n');
        expect(lastSlot).toBeLessThan(CSS.indexOf('\n}\n', mediaStart));
    });

    it('회원 추정 폭은 아바타·스켈레톤(size-10 = 2.5rem)과 같고, 언어 규칙보다 뒤에 있다', () => {
        const member = CSS.match(
            /:root\[data-auth-hint='member'\] \[data-header-auth-slot\]\s*\{([^}]*)\}/
        );
        expect(member).not.toBeNull();
        expect(minWidthRem(member?.[1] ?? '')).toBe(2.5);
        // 언어 규칙과 명시도가 같아(:root + 의사 클래스/속성 + 속성) 뒤에 와야 이긴다.
        expect(
            CSS.indexOf(
                ":root[data-auth-hint='member'] [data-header-auth-slot]"
            )
        ).toBeGreaterThan(CSS.lastIndexOf(':root:lang('));
    });

    it('회원 추정이면 게스트 묶음을 첫 페인트부터 숨긴다', () => {
        expect(CSS).toMatch(
            /:root\[data-auth-hint='member'\] \[data-header-guest-cta\]\s*\{\s*display:\s*none;\s*\}/
        );
    });
});

/**
 * 게스트 묶음(文A·◐ 버튼 + 로그인·회원가입 CTA)의 **실측 폭**과 예약 폭.
 *
 * jsdom엔 레이아웃이 없어 폭을 여기서 잴 수 없다. 그래서 1440px 실측값(Chromium, Pretendard 로드
 * 후, 2026-11-18)을 그때의 CTA 문구와 함께 고정한다. 문구가 바뀌면 첫 단언이 깨진다 — 그때는
 * 브라우저에서 `[data-header-guest-cta]` 폭을 다시 재 아래 표와 `globals.css`를 함께 고친다.
 *
 * 예약은 실측을 담아야 하고(모자라면 하이드레이션 때 헤더가 밀린다), 실측보다 크게 남으면 안 된다
 * (남는 폭이 文A 왼쪽 빈칸으로 보인다 — 언어별로 잡는 이유).
 */
const MEASURED_GUEST: Record<
    'ko' | 'en' | 'ja' | 'zh',
    { readonly login: string; readonly signup: string; readonly px: number }
> = {
    ko: { login: '로그인', signup: '회원가입', px: 236.7 },
    en: { login: 'Log In', signup: 'Sign Up', px: 241.0 },
    ja: { login: 'ログイン', signup: '会員登録', px: 265.3 },
    zh: { login: '登录', signup: '注册', px: 208.0 },
};
const CATALOGS = { ko, en, ja, zh } as const;
/** 예약이 실측을 넘어 남겨도 되는 폭 — 0.25rem 단위 올림 한 칸. */
const MAX_SLACK_PX = 0.25 * REM_PX;

function localeSlotPx(locale: keyof typeof MEASURED_GUEST): number {
    const rule = CSS.match(
        new RegExp(
            `:root:lang\\(${locale}\\) \\[data-header-auth-slot\\]\\s*\\{([^}]*)\\}`
        )
    );
    if (rule === null) throw new Error(`no slot rule for ${locale}`);
    return minWidthRem(rule[1] ?? '') * REM_PX;
}

describe('게스트 묶음 예약 폭 — 언어별', () => {
    it.each(Object.keys(MEASURED_GUEST) as (keyof typeof MEASURED_GUEST)[])(
        '%s: 실측 당시 문구 그대로이고, 예약이 실측을 담되 거의 남기지 않는다',
        locale => {
            const measured = MEASURED_GUEST[locale];
            const menu = CATALOGS[locale].widgets.layout.HeaderUserMenu;
            expect([menu.e225a6, menu.ecb4cc]).toEqual([
                measured.login,
                measured.signup,
            ]);
            const slot = localeSlotPx(locale);
            expect(slot).toBeGreaterThanOrEqual(measured.px);
            expect(slot - measured.px).toBeLessThanOrEqual(MAX_SLACK_PX);
        }
    );

    it('언어가 맞지 않는 문서의 기본 예약은 가장 넓은 언어를 담는다', () => {
        const fallback = CSS.match(
            /\{\s*\[data-header-auth-slot\]\s*\{([^}]*)\}/
        );
        const widest = Math.max(
            ...Object.values(MEASURED_GUEST).map(m => m.px)
        );
        expect(
            minWidthRem(fallback?.[1] ?? '') * REM_PX
        ).toBeGreaterThanOrEqual(widest);
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
