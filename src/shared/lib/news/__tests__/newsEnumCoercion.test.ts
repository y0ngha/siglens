import {
    toNewsCategory,
    toNewsImpact,
    toNewsSentiment,
} from '@/shared/lib/news/newsEnumCoercion';

describe('newsEnumCoercion', () => {
    describe('toNewsSentiment', () => {
        it.each(['bullish', 'bearish', 'neutral'])(
            '%s는 그대로 통과한다',
            v => {
                expect(toNewsSentiment(v)).toBe(v);
            }
        );

        it.each([null, undefined, 1, 'BULLISH', '', 'toString'])(
            '%s는 null로 강등한다',
            v => {
                expect(toNewsSentiment(v)).toBeNull();
            }
        );
    });

    describe('toNewsImpact', () => {
        it.each(['high', 'medium', 'low', 'negligible'])(
            '%s는 그대로 통과한다',
            v => {
                expect(toNewsImpact(v)).toBe(v);
            }
        );

        it.each([null, 3, 'critical', 'constructor'])(
            '%s는 null로 강등한다',
            v => {
                expect(toNewsImpact(v)).toBeNull();
            }
        );
    });

    describe('toNewsCategory', () => {
        it.each([
            'earnings',
            'm_and_a',
            'guidance',
            'regulation',
            'macro',
            'product',
            'other',
        ])('%s는 그대로 통과한다', v => {
            expect(toNewsCategory(v)).toBe(v);
        });

        it.each([null, 0, 'sports', 'hasOwnProperty'])(
            '%s는 null로 강등한다',
            v => {
                expect(toNewsCategory(v)).toBeNull();
            }
        );
    });
});
