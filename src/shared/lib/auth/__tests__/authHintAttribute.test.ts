// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
    AUTH_HINT_ATTRIBUTE,
    AUTH_HINT_INIT_SCRIPT,
    setAuthHintAttribute,
} from '@/shared/lib/auth/authHintAttribute';
import { readAuthHintCookie } from '@/shared/lib/auth/readAuthHintCookie';

/** `document.cookie`를 주어진 문자열로 고정한다(여러 쿠키를 한 번에 흉내 내기 위해). */
function withCookie(cookie: string): void {
    Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => cookie,
    });
}

/** 인라인 스크립트는 `<head>`에 문자열로 주입된다 — 실제로 실행해서 확인한다. */
function runInitScript(): string | null {
    new Function(AUTH_HINT_INIT_SCRIPT)();
    return document.documentElement.getAttribute(AUTH_HINT_ATTRIBUTE);
}

afterEach(() => {
    document.documentElement.removeAttribute(AUTH_HINT_ATTRIBUTE);
    Reflect.deleteProperty(document, 'cookie');
});

const COOKIE_CASES: readonly [string, string, 'member' | 'guest'][] = [
    ['힌트 쿠키가 값과 함께 있다', 'siglens_auth=1', 'member'],
    [
        '다른 쿠키 사이에 공백과 함께 있다',
        'a=1;  siglens_auth=1; b=2',
        'member',
    ],
    ['힌트 쿠키가 없다', 'a=1; b=2', 'guest'],
    ['로그아웃으로 값이 비었다', 'siglens_auth=', 'guest'],
    ['이름이 접두어만 같다', 'siglens_auth_x=1', 'guest'],
    ['쿠키가 하나도 없다', '', 'guest'],
];

describe('AUTH_HINT_INIT_SCRIPT', () => {
    it.each(COOKIE_CASES)('%s → %s', (_label, cookie, expected) => {
        withCookie(cookie);
        expect(runInitScript()).toBe(expected);
    });

    /** 번들 밖 문자열이라 `readAuthHintCookie`를 import하지 못해 같은 판정을 다시 쓴다. */
    it.each(COOKIE_CASES)(
        '%s — readAuthHintCookie와 같은 판정을 낸다',
        (_label, cookie) => {
            withCookie(cookie);
            expect(runInitScript()).toBe(
                readAuthHintCookie() ? 'member' : 'guest'
            );
        }
    );

    it('쿠키 접근이 throw해도 페이지를 깨지 않고 속성을 찍지 않는다(CSS 기본 = 게스트)', () => {
        Object.defineProperty(document, 'cookie', {
            configurable: true,
            get: () => {
                throw new Error('SecurityError');
            },
        });
        expect(runInitScript()).toBeNull();
    });
});

describe('setAuthHintAttribute', () => {
    it('세션 확정 상태로 <html data-auth-hint>를 찍는다', () => {
        setAuthHintAttribute('member');
        expect(document.documentElement.getAttribute(AUTH_HINT_ATTRIBUTE)).toBe(
            'member'
        );
        setAuthHintAttribute('guest');
        expect(document.documentElement.getAttribute(AUTH_HINT_ATTRIBUTE)).toBe(
            'guest'
        );
    });
});
