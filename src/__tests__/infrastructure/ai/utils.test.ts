import { toProviderTurns } from '@/infrastructure/ai/utils';
import type { ConversationTurn } from '@y0ngha/siglens-core';

describe('toProviderTurns', () => {
    describe('string contents', () => {
        it('문자열이면 단일 user 턴으로 반환한다', () => {
            const result = toProviderTurns('Hello');
            expect(result).toEqual([{ role: 'user', content: 'Hello' }]);
        });
    });

    describe('ConversationTurn[] contents', () => {
        it('빈 배열이면 빈 배열을 반환한다', () => {
            const result = toProviderTurns([]);
            expect(result).toEqual([]);
        });

        it('role이 user인 턴은 user로 그대로 매핑한다', () => {
            const contents: ConversationTurn[] = [
                { role: 'user', text: 'Hi' },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([{ role: 'user', content: 'Hi' }]);
        });

        it('role이 assistant인 턴은 assistant로 그대로 매핑한다', () => {
            const contents: ConversationTurn[] = [
                { role: 'assistant', text: 'Hello back' },
            ];
            const result = toProviderTurns(contents);
            expect(result).toEqual([
                { role: 'assistant', content: 'Hello back' },
            ]);
        });

        it('user/assistant 교대 히스토리를 순서대로 변환한다', () => {
            const contents: ConversationTurn[] = [
                { role: 'user', text: 'Q1' },
                { role: 'assistant', text: 'A1' },
                { role: 'user', text: 'Q2' },
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
