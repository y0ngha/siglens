import { resolveGateMode } from '@/features/premium-gate/lib/resolveGateMode';

describe('resolveGateMode', () => {
    it('비회원은 member 모델에도 auth 게이트', () => {
        expect(
            resolveGateMode({
                access: 'member',
                provider: 'anthropic',
                user: null,
                registeredProviders: [],
            })
        ).toBe('auth');
    });

    it('회원 여부를 아직 모르면 auth 게이트', () => {
        expect(
            resolveGateMode({
                access: 'byok',
                provider: 'anthropic',
                user: undefined,
                registeredProviders: ['anthropic'],
            })
        ).toBe('auth');
    });

    it('회원은 키 없이도 member 모델을 통과한다', () => {
        expect(
            resolveGateMode({
                access: 'member',
                provider: 'anthropic',
                user: { tier: 'free' },
                registeredProviders: [],
            })
        ).toBeNull();
    });

    it('pro 회원은 키 없이도 byok 모델을 통과한다', () => {
        expect(
            resolveGateMode({
                access: 'byok',
                provider: 'openai',
                user: { tier: 'pro' },
                registeredProviders: [],
            })
        ).toBeNull();
    });

    it('pro가 아닌 회원은 해당 프로바이더 키가 없으면 byok 게이트', () => {
        expect(
            resolveGateMode({
                access: 'byok',
                provider: 'openai',
                user: { tier: 'member' },
                registeredProviders: ['anthropic'],
            })
        ).toBe('byok');
    });

    it('pro가 아닌 회원도 해당 프로바이더 키가 있으면 통과한다', () => {
        expect(
            resolveGateMode({
                access: 'byok',
                provider: 'openai',
                user: { tier: 'member' },
                registeredProviders: ['anthropic', 'openai'],
            })
        ).toBeNull();
    });
});
