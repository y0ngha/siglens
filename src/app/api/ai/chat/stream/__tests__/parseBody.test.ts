import { describe, expect, it } from 'vitest';
import { followUpLine } from '@/app/api/ai/chat/followUps';
import {
    GUEST_HISTORY_MESSAGE_MAX_CHARS,
    parseBody,
} from '@/app/api/ai/chat/stream/_lib/parseBody';
import { MESSAGE_MAX_CHARS } from '@/features/agent-chat/lib/messageLimits';

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

    it('공백뿐인 메시지는 거절한다', () => {
        expect(parseBody({ message: '   ' })).toBeNull();
    });

    it('상한을 넘는 메시지는 거절한다', () => {
        expect(
            parseBody({ message: 'a'.repeat(MESSAGE_MAX_CHARS + 1) })
        ).toBeNull();
    });

    it('상한 길이 메시지는 받는다', () => {
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

    it('게스트 기록: 최근 20개만 남긴다', () => {
        const history = Array.from({ length: 25 }, (_, i) => ({
            role: 'user',
            content: `m${i}`,
        }));
        const parsed = parseBody({ message: 'x', history });
        expect(parsed?.history).toHaveLength(20);
        expect(parsed?.history[0]?.content).toBe('m5');
    });

    it('게스트 기록: 공백뿐인 항목은 버린다', () => {
        const parsed = parseBody({
            message: 'x',
            history: [
                { role: 'user', content: '  ' },
                { role: 'user', content: ' keep ' },
            ],
        });
        expect(parsed?.history).toEqual([{ role: 'user', content: 'keep' }]);
    });

    it('게스트 기록: 항목 길이를 상한으로 자른다', () => {
        const parsed = parseBody({
            message: 'x',
            history: [
                {
                    role: 'user',
                    content: 'z'.repeat(GUEST_HISTORY_MESSAGE_MAX_CHARS + 10),
                },
            ],
        });
        expect(parsed?.history[0]?.content).toHaveLength(
            GUEST_HISTORY_MESSAGE_MAX_CHARS
        );
    });

    it('게스트 기록: assistant 답변에는 후속 질문 마커 줄을 되붙인다', () => {
        const followUps = ['더 알려줘', '다른 종목은?'];
        const parsed = parseBody({
            message: 'x',
            history: [{ role: 'assistant', content: 'ans', followUps }],
        });
        expect(parsed?.history[0]?.content).toBe(
            `ans${followUpLine(followUps)}`
        );
    });

    it('게스트 기록: 마커 줄이 붙어도 상한을 넘지 않고 줄은 잘리지 않는다', () => {
        const followUps = ['더 알려줘'];
        const line = followUpLine(followUps);
        const parsed = parseBody({
            message: 'x',
            history: [
                {
                    role: 'assistant',
                    content: 'z'.repeat(GUEST_HISTORY_MESSAGE_MAX_CHARS),
                    followUps,
                },
            ],
        });
        const content = parsed?.history[0]?.content ?? '';
        expect(content).toHaveLength(GUEST_HISTORY_MESSAGE_MAX_CHARS);
        expect(content.endsWith(line)).toBe(true);
    });

    it('게스트 기록: user 항목의 followUps는 무시한다', () => {
        const parsed = parseBody({
            message: 'x',
            history: [{ role: 'user', content: 'q', followUps: ['a'] }],
        });
        expect(parsed?.history[0]?.content).toBe('q');
    });
});
