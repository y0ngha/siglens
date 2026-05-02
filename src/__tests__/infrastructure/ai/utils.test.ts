import { toProviderTurns } from '@/infrastructure/ai/utils';
import type { GeminiContent } from '@y0ngha/siglens-core';

describe('toProviderTurns', () => {
    describe('string contents', () => {
        it('문자열이면 단일 user 턴으로 반환한다', () => {
            const result = toProviderTurns('Hello');
            expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
        });
    });

    describe('GeminiContent[] contents', () => {
        it('role이 user인 턴은 user로 변환한다', () => {
            const contents: GeminiContent[] = [
                { role: 'user', parts: [{ text: 'Hi' }] },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([{ role: 'user', content: 'Hi' }]);
        });

        it('role이 model인 턴은 assistant로 변환한다', () => {
            const contents: GeminiContent[] = [
                { role: 'model', parts: [{ text: 'Hello back' }] },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([
                { role: 'assistant', content: 'Hello back' },
            ]);
        });

        it('복수 part의 text를 이어붙여 content를 구성한다', () => {
            const contents: GeminiContent[] = [
                {
                    role: 'user',
                    parts: [{ text: 'Hello ' }, { text: 'world' }],
                },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([{ role: 'user', content: 'Hello world' }]);
        });

        it('part.text가 undefined이면 빈 문자열로 처리한다', () => {
            const contents: GeminiContent[] = [
                {
                    role: 'user',
                    parts: [{ text: undefined as unknown as string }],
                },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([{ role: 'user', content: '' }]);
        });

        it('user/model 교대 히스토리를 순서대로 변환한다', () => {
            const contents: GeminiContent[] = [
                { role: 'user', parts: [{ text: 'Q1' }] },
                { role: 'model', parts: [{ text: 'A1' }] },
                { role: 'user', parts: [{ text: 'Q2' }] },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([
                { role: 'user', content: 'Q1' },
                { role: 'assistant', content: 'A1' },
                { role: 'user', content: 'Q2' },
            ]);
        });
    });
});
