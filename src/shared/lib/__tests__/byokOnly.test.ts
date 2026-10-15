import {
    assertByokOnlyRouting,
    assertCallerRouting,
    ByokOnlyRoutingError,
    CACHE_PROBE_KEY_PLACEHOLDER,
    tierForByokOnly,
} from '@/shared/lib/byokOnly';

/** core 로스터에서 등급별로 하나씩 — 실제 `requiresByokKey`가 판정한다. */
const BYOK_MODEL = 'claude-opus-5';
const MEMBER_MODEL = 'claude-sonnet-5-5';
const FREE_MODEL = 'claude-haiku-5-5';
const USER_KEY = 'sk-user-key';

describe('tierForByokOnly', () => {
    it.each([
        ['pro', 'member'],
        ['member', 'member'],
        ['free', 'free'],
    ] as const)('%s -> %s', (tier, expected) => {
        expect(tierForByokOnly(tier)).toBe(expected);
    });
});

describe('assertByokOnlyRouting', () => {
    const ok = {
        tier: 'member',
        modelId: BYOK_MODEL,
        userApiKey: USER_KEY,
        cacheOnly: false,
    } as const;

    it('byok 등급 모델 + non-pro tier + 사용자 키는 통과한다', () => {
        expect(() => assertByokOnlyRouting(ok)).not.toThrow();
        expect(() =>
            assertByokOnlyRouting({ ...ok, tier: 'free' })
        ).not.toThrow();
    });

    it('pro tier는 core가 서버 키를 고르므로 거절한다', () => {
        expect(() => assertByokOnlyRouting({ ...ok, tier: 'pro' })).toThrow(
            ByokOnlyRoutingError
        );
    });

    it.each([MEMBER_MODEL, FREE_MODEL] as const)(
        'byok 등급이 아닌 모델(%s)은 core가 서버 키를 고르므로 거절한다',
        modelId => {
            expect(() => assertByokOnlyRouting({ ...ok, modelId })).toThrow(
                ByokOnlyRoutingError
            );
        }
    );

    it.each([undefined, ''])('키가 %j이면 거절한다', userApiKey => {
        expect(() => assertByokOnlyRouting({ ...ok, userApiKey })).toThrow(
            ByokOnlyRoutingError
        );
    });

    it('자리표시 키는 cacheOnly일 때만 허용한다', () => {
        const probe = { ...ok, userApiKey: CACHE_PROBE_KEY_PLACEHOLDER };
        expect(() =>
            assertByokOnlyRouting({ ...probe, cacheOnly: true })
        ).not.toThrow();
        expect(() =>
            assertByokOnlyRouting({ ...probe, cacheOnly: false })
        ).toThrow(ByokOnlyRoutingError);
    });

    it('등록되지 않은 모델 ID는 던진다(서버 키로 새지 않는다)', () => {
        expect(() =>
            assertByokOnlyRouting({
                ...ok,
                modelId: 'no-such-model' as typeof BYOK_MODEL,
            })
        ).toThrow();
    });
});

describe('assertCallerRouting', () => {
    it('byokOnly가 아닌 호출자(쿠키 액션)는 검사하지 않는다', () => {
        expect(() =>
            assertCallerRouting({ userId: 'u', tier: 'pro' }, FREE_MODEL, false)
        ).not.toThrow();
    });

    it('byokOnly 호출자는 검사한다', () => {
        expect(() =>
            assertCallerRouting(
                {
                    userId: 'u',
                    tier: 'pro',
                    userApiKey: USER_KEY,
                    byokOnly: true,
                },
                BYOK_MODEL,
                false
            )
        ).toThrow(ByokOnlyRoutingError);
        expect(() =>
            assertCallerRouting(
                {
                    userId: 'u',
                    tier: 'member',
                    userApiKey: USER_KEY,
                    byokOnly: true,
                },
                BYOK_MODEL,
                false
            )
        ).not.toThrow();
    });
});
