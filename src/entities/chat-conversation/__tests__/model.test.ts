import { describe, expect, it } from 'vitest';
import {
    deriveTitle,
    toAgentHistory,
} from '@/entities/chat-conversation/model';

describe('deriveTitle', () => {
    it('첫 줄 60자, 빈 문자열은 기본 제목', () => {
        expect(deriveTitle('x'.repeat(100) + '\n둘째 줄')).toBe(
            'x'.repeat(60) + '…'
        );
        expect(deriveTitle('   ')).toBe('새 대화');
    });

    it('정확히 60자면 잘리지 않고 말줄임표도 없다', () => {
        const exact = 'x'.repeat(60);
        expect(deriveTitle(exact)).toBe(exact);
    });

    it('\\r\\n과 \\r 단독을 개행으로 취급해 첫 줄에 \\r이 남지 않는다', () => {
        expect(deriveTitle('첫 줄\r\n둘째 줄')).toBe('첫 줄');
        expect(deriveTitle('첫 줄\r둘째 줄')).toBe('첫 줄');
    });

    it('서로게이트 쌍(이모지)을 코드 포인트 단위로 잘라 반쪽을 남기지 않는다', () => {
        // 61개의 2-code-unit 이모지 — length(UTF-16 unit) 기준으로 슬라이스하면
        // 61번째 code unit(서로게이트 쌍의 앞쪽 절반)에서 잘려 깨진 문자가 남는다.
        const line = '😀'.repeat(61);
        const title = deriveTitle(line).replace(/…$/, '');
        expect(Array.from(title)).toHaveLength(60);
        expect(title).toBe('😀'.repeat(60));
    });

    it('로케일별 기본 제목', () => {
        expect(deriveTitle('   ', 'ko')).toBe('새 대화');
        expect(deriveTitle('   ', 'en')).toBe('New chat');
        expect(deriveTitle('   ', 'ja')).toBe('新しいチャット');
        expect(deriveTitle('   ', 'zh')).toBe('新对话');
    });
});

describe('toAgentHistory', () => {
    it('superseded/error 행을 빼고 캐노니컬 메시지로', () => {
        const rows = [
            {
                role: 'user',
                content: 'q',
                toolCalls: null,
                toolCallId: null,
                toolName: null,
                status: 'complete',
            },
            {
                role: 'assistant',
                content: '',
                toolCalls: [{ id: 'c1', name: 'get_quote', args: {} }],
                toolCallId: null,
                toolName: null,
                status: 'complete',
            },
            {
                role: 'tool',
                content: '{}',
                toolCalls: null,
                toolCallId: 'c1',
                toolName: 'get_quote',
                status: 'complete',
            },
            {
                role: 'assistant',
                content: 'old',
                toolCalls: null,
                toolCallId: null,
                toolName: null,
                status: 'superseded',
            },
            {
                role: 'assistant',
                content: 'err',
                toolCalls: null,
                toolCallId: null,
                toolName: null,
                status: 'error',
            },
            {
                role: 'assistant',
                content: 'new',
                toolCalls: null,
                toolCallId: null,
                toolName: null,
                status: 'complete',
            },
        ] as const;
        expect(toAgentHistory(rows as never)).toEqual([
            { role: 'user', content: 'q' },
            {
                role: 'assistant',
                content: '',
                toolCalls: [{ id: 'c1', name: 'get_quote', args: {} }],
            },
            {
                role: 'tool',
                content: '{}',
                toolCallId: 'c1',
                toolName: 'get_quote',
            },
            { role: 'assistant', content: 'new' },
        ]);
    });

    it('aborted 행은 유지한다(부분 응답도 유효한 컨텍스트)', () => {
        const rows = [
            {
                role: 'assistant',
                content: '중간까지',
                toolCalls: null,
                toolCallId: null,
                toolName: null,
                status: 'aborted',
            },
        ] as const;
        expect(toAgentHistory(rows as never)).toEqual([
            { role: 'assistant', content: '중간까지' },
        ]);
    });
});
