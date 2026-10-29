import { describe, expect, it } from 'vitest';
import {
    GUEST_HISTORY_MESSAGE_MAX_CHARS,
    MESSAGE_MAX_CHARS,
    parseBody,
} from '@/app/api/ai/chat/stream/_lib/parseBody';

describe('parseBody', () => {
    it('action 생략 시 send로 해석한다', () => {
        expect(parseBody({ message: ' hi ' })).toEqual({
            conversationId: null,
            message: 'hi',
            action: 'send',
            history: [],
        });
    });

    it('배열이 문자열로 바뀌면 send와 같아 보이는 action도 거절한다', () => {
        expect(parseBody({ action: ['send'], message: 'x' })).toBeNull();
    });

    it('action: null은 거절한다', () => {
        expect(parseBody({ action: null, message: 'x' })).toBeNull();
    });

    it('빈 메시지와 4,001자 메시지는 거절하고 4,000자는 받는다', () => {
        expect(parseBody({ message: '   ' })).toBeNull();
        expect(
            parseBody({ message: 'a'.repeat(MESSAGE_MAX_CHARS + 1) })
        ).toBeNull();
        expect(
            parseBody({ message: 'a'.repeat(MESSAGE_MAX_CHARS) })
        ).not.toBeNull();
    });

    it('regenerate는 빈 메시지를 허용한다', () => {
        expect(parseBody({ action: 'regenerate' })).toMatchObject({
            action: 'regenerate',
            message: '',
        });
    });

    it.each([0, -1, 1.5, '2', null, undefined])(
        'edit: editSeq=%s는 거절한다',
        editSeq => {
            expect(
                parseBody({ action: 'edit', message: 'x', editSeq })
            ).toBeNull();
        }
    );

    it('edit: 양의 정수 editSeq는 본문에 실린다', () => {
        expect(
            parseBody({ action: 'edit', message: 'x', editSeq: 3 })
        ).toMatchObject({ action: 'edit', editSeq: 3 });
    });

    it('게스트 기록: 형식이 틀리면 거절한다', () => {
        expect(parseBody({ message: 'x', history: 'no' })).toBeNull();
        expect(
            parseBody({
                message: 'x',
                history: [{ role: 'tool', content: 'c' }],
            })
        ).toBeNull();
    });

    it('게스트 기록: 최근 20개만 남기고 빈 메시지는 버리며 길이를 자른다', () => {
        const history = Array.from({ length: 25 }, (_, i) => ({
            role: 'user',
            content: `m${i}`,
        }));
        history[24] = {
            role: 'assistant',
            content: 'z'.repeat(GUEST_HISTORY_MESSAGE_MAX_CHARS + 10),
        };
        history[23] = { role: 'user', content: '  ' };
        const parsed = parseBody({ message: 'x', history });
        expect(parsed?.history).toHaveLength(19);
        expect(parsed?.history.at(-1)?.content).toHaveLength(
            GUEST_HISTORY_MESSAGE_MAX_CHARS
        );
    });
});
