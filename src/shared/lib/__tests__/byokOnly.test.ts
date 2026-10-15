import {
    ByokOnlyRoutingError,
    resolveCallerKeyOptions,
    type AnalysisCaller,
} from '@/shared/lib/byokOnly';

const USER_KEY = 'sk-user-key';

const byokCaller = (
    overrides: Partial<AnalysisCaller> = {}
): AnalysisCaller => ({
    userId: 'u',
    tier: 'pro',
    byokOnly: true,
    userApiKey: USER_KEY,
    ...overrides,
});

describe('resolveCallerKeyOptions', () => {
    describe('BYOK 전용 호출자', () => {
        it.each(['free', 'member', 'pro'] as const)(
            '%s tier도 keyPolicy byok-only와 사용자 키를 싣는다(tier로 키를 고르지 않는다)',
            tier => {
                expect(
                    resolveCallerKeyOptions(byokCaller({ tier }), false)
                ).toEqual({ keyPolicy: 'byok-only', userApiKey: USER_KEY });
            }
        );

        it('캐시 확인 호출은 키가 있으면 그 키로, 없으면 키 없이 byok-only로 보낸다', () => {
            expect(resolveCallerKeyOptions(byokCaller(), true)).toEqual({
                keyPolicy: 'byok-only',
                userApiKey: USER_KEY,
            });
            expect(
                resolveCallerKeyOptions(
                    byokCaller({ userApiKey: undefined }),
                    true
                )
            ).toEqual({ keyPolicy: 'byok-only' });
        });

        it('빈 문자열 키는 키가 없는 것으로 본다(캐시 확인은 키 없이 보낸다)', () => {
            expect(
                resolveCallerKeyOptions(byokCaller({ userApiKey: '' }), true)
            ).toEqual({ keyPolicy: 'byok-only' });
        });

        it.each([undefined, ''])(
            '생성 호출에 키가 %j이면 core를 부르기 전에 던진다',
            userApiKey => {
                expect(() =>
                    resolveCallerKeyOptions(byokCaller({ userApiKey }), false)
                ).toThrow(ByokOnlyRoutingError);
            }
        );
    });

    describe('쿠키 액션 호출자(byokOnly 아님)', () => {
        it('keyPolicy를 싣지 않고(기본 tier 정책) 키만 그대로 싣는다', () => {
            const options = resolveCallerKeyOptions(
                { userId: 'u', tier: 'free', userApiKey: USER_KEY },
                false
            );
            expect(options).toEqual({ userApiKey: USER_KEY });
            expect(options).not.toHaveProperty('keyPolicy');
        });

        it('키가 없어도 던지지 않고 아무것도 싣지 않는다', () => {
            expect(
                resolveCallerKeyOptions({ userId: null, tier: 'free' }, false)
            ).toEqual({});
        });

        it('byokOnly: false도 쿠키 액션과 같다', () => {
            expect(
                resolveCallerKeyOptions(
                    { userId: 'u', tier: 'pro', byokOnly: false },
                    false
                )
            ).toEqual({});
        });
    });
});
