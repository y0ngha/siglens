import {
    createCallDeadline,
    ProviderCallTimeoutError,
    findSpecByApiModelId,
    toProviderTurns,
} from '@/entities/llm-provider/lib/utils';
import type { ConversationTurn } from '@y0ngha/siglens-core';

describe('findSpecByApiModelId', () => {
    it('유효한 apiModelId로 일치하는 ModelSpec을 반환한다', () => {
        // MODEL_SPECS의 'claude-sonnet-5' 키는 apiModelId 'claude-sonnet-5'을 가진다.
        const result = findSpecByApiModelId('claude-sonnet-5');
        expect(result).toBeDefined();
        expect(result?.apiModelId).toBe('claude-sonnet-5');
    });

    it('존재하지 않는 apiModelId는 undefined를 반환한다', () => {
        const result = findSpecByApiModelId('non-existent-model-id');
        expect(result).toBeUndefined();
    });
});

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
            const contents: ConversationTurn[] = [{ role: 'user', text: 'Hi' }];
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

describe('createCallDeadline', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('timeoutMs가 없으면 signal 없이 작업을 그대로 통과시킨다', async () => {
        const deadline = createCallDeadline(undefined);

        expect(deadline.signal).toBeUndefined();
        await expect(deadline.guard(Promise.resolve('x'))).resolves.toBe('x');
    });

    it('마감이 지나면 signal을 abort하고 guard가 timeout 오류로 거절한다', async () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);
        const assertion = expect(
            deadline.guard(new Promise(() => {}))
        ).rejects.toBeInstanceOf(ProviderCallTimeoutError);

        await vi.advanceTimersByTimeAsync(1_000);
        await assertion;

        expect(deadline.signal?.aborted).toBe(true);
    });

    it('마감 전에 dispose하면 타이머가 정리돼 abort되지 않는다', async () => {
        vi.useFakeTimers();
        const deadline = createCallDeadline(1_000);

        await expect(deadline.guard(Promise.resolve(1))).resolves.toBe(1);
        deadline.dispose();
        await vi.advanceTimersByTimeAsync(5_000);

        expect(deadline.signal?.aborted).toBe(false);
    });
});
