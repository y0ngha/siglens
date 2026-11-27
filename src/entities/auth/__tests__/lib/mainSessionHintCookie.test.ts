const urls = vi.hoisted(() => ({
    main: 'https://siglens.io',
    ai: 'https://ai.siglens.io',
}));
vi.mock('@/shared/config/aiHost', () => ({
    get MAIN_SITE_URL() {
        return urls.main;
    },
    get AI_SITE_URL() {
        return urls.ai;
    },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAIN_SESSION_HINT_COOKIE_NAME } from '@/shared/config/cookieNames';
import { DEFAULT_SESSION_TTL_SECONDS } from '@/entities/auth/lib/sessionCookie';
import {
    clearMainSessionHint,
    createExpiredMainSessionHintCookie,
    createMainSessionHintCookie,
    mainSessionHintDomain,
    resolveMainSessionHintDomain,
    setMainSessionHint,
    shouldStartHandoff,
} from '@/entities/auth/lib/mainSessionHintCookie';

describe('resolveMainSessionHintDomain', () => {
    it.each([
        ['https://siglens.io', 'https://ai.siglens.io', 'siglens.io'],
        ['https://SIGLENS.io/', 'https://AI.siglens.io/x', 'siglens.io'],
        ['http://localhost:4300', 'http://ai.localhost:4300', null],
        ['http://127.0.0.1:3000', 'http://ai.127.0.0.1:3000', null],
        ['http://[::1]:3000', 'http://ai.[::1]:3000', null],
        ['https://siglens.io', 'https://ai.example.com', null],
        ['https://siglens.io', 'https://siglens.io', null],
        ['https://siglens.io', 'https://evilsiglens.io', null],
        ['not a url', 'https://ai.siglens.io', null],
        ['https://siglens.io', '', null],
    ])('%s + %s -> %s', (main, ai, expected) => {
        expect(resolveMainSessionHintDomain(main, ai)).toBe(expected);
    });
});

describe('main session hint cookie (gate active)', () => {
    beforeEach(() => {
        urls.main = 'https://siglens.io';
        urls.ai = 'https://ai.siglens.io';
    });

    it('mainSessionHintDomain reads the URLs at call time', () => {
        expect(mainSessionHintDomain()).toBe('siglens.io');
        urls.main = 'http://localhost:4300';
        urls.ai = 'http://ai.localhost:4300';
        expect(mainSessionHintDomain()).toBeNull();
    });

    it('create: value 1, parent domain, HttpOnly, session lifetime, no identifier', () => {
        expect(createMainSessionHintCookie({ secure: true })).toEqual({
            name: MAIN_SESSION_HINT_COOKIE_NAME,
            value: '1',
            maxAge: DEFAULT_SESSION_TTL_SECONDS,
            path: '/',
            domain: 'siglens.io',
            sameSite: 'lax',
            secure: true,
            httpOnly: true,
        });
    });

    it('create passes secure=false through (next dev over http)', () => {
        expect(createMainSessionHintCookie({ secure: false })?.secure).toBe(
            false
        );
    });

    it('expired: empty value, maxAge 0, same domain and path as the set cookie', () => {
        const set = createMainSessionHintCookie({ secure: true });
        const expired = createExpiredMainSessionHintCookie({ secure: true });
        expect(expired).toEqual({
            name: MAIN_SESSION_HINT_COOKIE_NAME,
            value: '',
            maxAge: 0,
            path: '/',
            domain: 'siglens.io',
            sameSite: 'lax',
            secure: true,
            httpOnly: true,
        });
        expect(expired?.domain).toBe(set?.domain);
        expect(expired?.path).toBe(set?.path);
    });

    it('setMainSessionHint writes the set descriptor to the store', () => {
        const set = vi.fn();
        setMainSessionHint({ set }, { secure: true });
        expect(set).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith(
            createMainSessionHintCookie({ secure: true })
        );
    });

    it('clearMainSessionHint writes the expired descriptor to the store', () => {
        const set = vi.fn();
        clearMainSessionHint({ set }, { secure: false });
        expect(set).toHaveBeenCalledTimes(1);
        expect(set).toHaveBeenCalledWith(
            createExpiredMainSessionHintCookie({ secure: false })
        );
    });

    it('shouldStartHandoff is true only for the hint value 1', () => {
        expect(shouldStartHandoff('1')).toBe(true);
        expect(shouldStartHandoff(undefined)).toBe(false);
        expect(shouldStartHandoff('')).toBe(false);
        expect(shouldStartHandoff('0')).toBe(false);
    });
});

describe('main session hint cookie (gate inactive: local hosts)', () => {
    beforeEach(() => {
        urls.main = 'http://localhost:4300';
        urls.ai = 'http://ai.localhost:4300';
    });

    it('writes no cookie, set or expired', () => {
        expect(createMainSessionHintCookie({ secure: false })).toBeNull();
        expect(
            createExpiredMainSessionHintCookie({ secure: false })
        ).toBeNull();
    });

    it('set and clear helpers do not touch the store', () => {
        const set = vi.fn();
        setMainSessionHint({ set }, { secure: false });
        clearMainSessionHint({ set }, { secure: false });
        expect(set).not.toHaveBeenCalled();
    });

    it('shouldStartHandoff is always true (legacy: always probe)', () => {
        expect(shouldStartHandoff(undefined)).toBe(true);
        expect(shouldStartHandoff('0')).toBe(true);
        expect(shouldStartHandoff('1')).toBe(true);
    });
});
