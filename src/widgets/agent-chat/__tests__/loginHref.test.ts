import { describe, expect, it } from 'vitest';
import { loginHref } from '@/widgets/agent-chat/loginHref';

describe('loginHref', () => {
    it('wraps the ai-host handoff path in the main-host login next param', () => {
        expect(loginHref('https://siglens.io', '', '/c/abc')).toBe(
            'https://siglens.io/login?next=' +
                encodeURIComponent(
                    '/api/auth/handoff?to=ai&next=' +
                        encodeURIComponent('/c/abc')
                )
        );
    });

    it('keeps the locale prefix on the main-host login path', () => {
        expect(loginHref('https://siglens.io', '/en', '/')).toBe(
            'https://siglens.io/en/login?next=' +
                encodeURIComponent(
                    '/api/auth/handoff?to=ai&next=' + encodeURIComponent('/')
                )
        );
    });
});
