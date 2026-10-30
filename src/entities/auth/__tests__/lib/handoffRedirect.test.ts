import {
    aiSignedOutUrl,
    handoffStartUrl,
    toHandoffAwareRedirect,
} from '@/entities/auth/lib/handoffRedirect';

describe('handoffRedirect', () => {
    describe('handoffStartUrl', () => {
        it('points at the ai-host start route with the locale carried in next', () => {
            expect(handoffStartUrl('/en/c/abc').href).toBe(
                'https://ai.siglens.io/api/auth/handoff/start?next=%2Fen%2Fc%2Fabc'
            );
        });

        it('reduces an off-origin next to the locale root', () => {
            expect(handoffStartUrl('https://evil.com/x').href).toBe(
                'https://ai.siglens.io/api/auth/handoff/start?next=%2F'
            );
        });
    });

    describe('toHandoffAwareRedirect', () => {
        it('turns the same-host issue path into the absolute ai start URL (hard navigation)', () => {
            expect(
                toHandoffAwareRedirect(
                    '/api/auth/handoff?to=ai&next=%2Fen%2Fc%2Fabc'
                )
            ).toBe(
                'https://ai.siglens.io/api/auth/handoff/start?next=%2Fen%2Fc%2Fabc'
            );
        });

        it.each([
            '/',
            '/en/AAPL',
            '/portfolio',
            '/api/auth/handoff?to=other&next=%2Fc%2Fabc',
            '/api/auth/handoff/start?next=%2Fc%2Fabc',
        ])('leaves %j unchanged', target => {
            expect(toHandoffAwareRedirect(target)).toBe(target);
        });
    });

    it('aiSignedOutUrl is the locale ai landing with ?sso=none', () => {
        expect(aiSignedOutUrl('en').href).toBe(
            'https://ai.siglens.io/en?sso=none'
        );
    });
});
