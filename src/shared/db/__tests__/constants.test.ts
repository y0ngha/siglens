import {
    LLM_PROVIDER_VALUES,
    OAUTH_PROVIDER_VALUES,
    TERMS_KIND_VALUES,
    USAGE_ACTION_TYPE_VALUES,
    USER_TIER_VALUES,
} from '@/shared/db/constants';

describe('USER_TIER_VALUES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(USER_TIER_VALUES.length).toBeGreaterThan(0);
    });

    it('모든 항목이 비어있지 않은 문자열이다', () => {
        for (const tier of USER_TIER_VALUES) {
            expect(typeof tier).toBe('string');
            expect(tier.length).toBeGreaterThan(0);
        }
    });

    it('중복 값이 없다', () => {
        expect(new Set(USER_TIER_VALUES).size).toBe(USER_TIER_VALUES.length);
    });

    it("'free', 'member', 'pro'를 포함한다", () => {
        expect([...USER_TIER_VALUES]).toEqual(['free', 'member', 'pro']);
    });
});

describe('USAGE_ACTION_TYPE_VALUES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(USAGE_ACTION_TYPE_VALUES.length).toBeGreaterThan(0);
    });

    it('모든 항목이 비어있지 않은 문자열이다', () => {
        for (const action of USAGE_ACTION_TYPE_VALUES) {
            expect(typeof action).toBe('string');
            expect(action.length).toBeGreaterThan(0);
        }
    });

    it('중복 값이 없다', () => {
        expect(new Set(USAGE_ACTION_TYPE_VALUES).size).toBe(
            USAGE_ACTION_TYPE_VALUES.length
        );
    });

    it("'analysis', 'chatbot', 'premium_model'을 포함한다", () => {
        expect([...USAGE_ACTION_TYPE_VALUES]).toEqual([
            'analysis',
            'chatbot',
            'premium_model',
        ]);
    });
});

describe('OAUTH_PROVIDER_VALUES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(OAUTH_PROVIDER_VALUES.length).toBeGreaterThan(0);
    });

    it('모든 항목이 비어있지 않은 문자열이다', () => {
        for (const provider of OAUTH_PROVIDER_VALUES) {
            expect(typeof provider).toBe('string');
            expect(provider.length).toBeGreaterThan(0);
        }
    });

    it('중복 값이 없다', () => {
        expect(new Set(OAUTH_PROVIDER_VALUES).size).toBe(
            OAUTH_PROVIDER_VALUES.length
        );
    });

    it("'google', 'kakao', 'apple'을 포함한다", () => {
        expect([...OAUTH_PROVIDER_VALUES]).toEqual([
            'google',
            'kakao',
            'apple',
        ]);
    });
});

describe('TERMS_KIND_VALUES', () => {
    it('비어있지 않은 배열이다', () => {
        expect(TERMS_KIND_VALUES.length).toBeGreaterThan(0);
    });

    it('모든 항목이 비어있지 않은 문자열이다', () => {
        for (const kind of TERMS_KIND_VALUES) {
            expect(typeof kind).toBe('string');
            expect(kind.length).toBeGreaterThan(0);
        }
    });

    it('중복 값이 없다', () => {
        expect(new Set(TERMS_KIND_VALUES).size).toBe(TERMS_KIND_VALUES.length);
    });

    it("'privacy', 'tos'를 포함한다", () => {
        expect([...TERMS_KIND_VALUES]).toEqual(['privacy', 'tos']);
    });
});

describe('LLM_PROVIDER_VALUES (re-export)', () => {
    it('shared/config/llmProviders의 값과 동일하다', () => {
        expect([...LLM_PROVIDER_VALUES]).toEqual([
            'anthropic',
            'google',
            'openai',
        ]);
    });
});
