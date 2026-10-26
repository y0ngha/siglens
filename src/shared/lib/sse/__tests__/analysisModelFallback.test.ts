import { readAnalysisModelFallback } from '@/shared/lib/sse/analysisModelFallback';

describe('readAnalysisModelFallback', () => {
    it('모양이 맞으면 from/to를 꺼낸다', () => {
        expect(
            readAnalysisModelFallback({
                status: 'done',
                modelFallback: {
                    from: 'claude-haiku-5-5',
                    to: 'deepseek-v4.1-flash',
                },
            })
        ).toEqual({ from: 'claude-haiku-5-5', to: 'deepseek-v4.1-flash' });
    });

    it.each([
        ['결과가 객체가 아님', 'done'],
        ['null', null],
        ['필드 없음', { status: 'done' }],
        ['필드가 객체가 아님', { modelFallback: 'x' }],
        ['to 없음', { modelFallback: { from: 'a' } }],
        ['문자열이 아님', { modelFallback: { from: 1, to: 2 } }],
    ])('%s → null', (_, value) => {
        expect(readAnalysisModelFallback(value)).toBeNull();
    });
});
