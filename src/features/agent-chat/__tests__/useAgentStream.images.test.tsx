import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import { useAgentStream } from '@/features/agent-chat/hooks/useAgentStream';
import type {
    AgentUiMessage,
    ChatImageAttachment,
} from '@/features/agent-chat/model/types';

vi.mock('@/shared/lib/googleAds', () => ({ trackAdsConversion: vi.fn() }));

const DONE = [
    'event: meta\ndata: {"conversationId":null,"userMessageId":null,"userMessageSeq":null}',
    'event: text\ndata: {"delta":"답"}',
    'event: done\ndata: {"assistantMessageId":"","stopReason":"end"}',
];

function sse(frames: string[]): Response {
    return new Response(
        new ReadableStream<Uint8Array>({
            start(c) {
                frames.forEach(f =>
                    c.enqueue(new TextEncoder().encode(`${f}\n\n`))
                );
                c.close();
            },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
    );
}

const image = (id: string, data: string): ChatImageAttachment => ({
    id,
    src: `blob:${id}`,
    width: 10,
    height: 8,
    payload: { mediaType: 'image/jpeg', data },
});

const bodyOf = (spy: ReturnType<typeof vi.spyOn>, i: number) =>
    JSON.parse(String(spy.mock.calls[i]?.[1]?.body));

afterEach(() => vi.restoreAllMocks());

describe('useAgentStream — 이미지', () => {
    it('send: 이미지 payload를 본문에 싣고 낙관적 말풍선에 첨부를 단다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => sse(DONE));
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        const attached = [image('a', 'AAAA'), image('b', 'BBBB')];
        act(() => {
            void result.current.send('', attached);
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(bodyOf(fetchSpy, 0)).toEqual({
            conversationId: null,
            action: 'send',
            message: '',
            images: [
                { mediaType: 'image/jpeg', data: 'AAAA' },
                { mediaType: 'image/jpeg', data: 'BBBB' },
            ],
        });
        // 턴이 끝나면 회원의 payload는 상태에서 덜어 낸다(본문에는 이미 실었다).
        expect(result.current.messages[0]?.images).toEqual(
            attached.map(({ payload: _sent, ...rest }) => rest)
        );
    });

    it('이미지가 없으면 본문에 images 키가 없다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => sse(DONE));
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('질문');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(bodyOf(fetchSpy, 0)).not.toHaveProperty('images');
        expect(result.current.messages[0]).not.toHaveProperty('images');
    });

    it('게스트: 기록에 imageCount를 싣고, 재생성은 메모리의 payload를 다시 보낸다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => sse(DONE));
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        act(() => {
            void result.current.send('이거 어때?', [image('a', 'AAAA')]);
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        act(() => {
            void result.current.send('그럼 이건?');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(bodyOf(fetchSpy, 1).history).toEqual([
            { role: 'user', content: '이거 어때?', imageCount: 1 },
            { role: 'assistant', content: '답' },
        ]);
        expect(bodyOf(fetchSpy, 1)).not.toHaveProperty('images');

        // 마지막 질문(이미지 없음)이 아니라, 이미지 질문을 다시 물으려면 그 질문이 마지막이어야 한다.
        const second = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        act(() => {
            void second.result.current.send('이거 어때?', [image('a', 'AAAA')]);
        });
        await waitFor(() => expect(second.result.current.status).toBe('idle'));
        act(() => {
            void second.result.current.regenerate();
        });
        await waitFor(() => expect(second.result.current.status).toBe('idle'));
        expect(bodyOf(fetchSpy, 2)).toMatchObject({
            action: 'send',
            message: '이거 어때?',
            images: [{ mediaType: 'image/jpeg', data: 'AAAA' }],
            history: [],
        });
    });

    it('회원 regenerate는 이미지를 본문에 싣지 않는다(서버가 보관한 것을 다시 읽는다)', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => sse(DONE));
        const stored: ChatMessageView[] = [
            {
                id: 'u1',
                seq: 1,
                role: 'user',
                content: '이거 어때?',
                toolCalls: null,
                toolName: null,
                status: 'complete',
                createdAt: new Date(2026, 0, 1).toISOString(),
                images: [{ id: 'img-1', width: 10, height: 8 }],
            },
            {
                id: 'a1',
                seq: 2,
                role: 'assistant',
                content: '답',
                toolCalls: null,
                toolName: null,
                status: 'complete',
                createdAt: new Date(2026, 0, 1).toISOString(),
            },
        ];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: stored })
        );
        expect(result.current.messages[0]?.images).toEqual([
            {
                id: 'img-1',
                width: 10,
                height: 8,
                src: '/api/ai/chat/images/img-1',
            },
        ]);
        act(() => {
            void result.current.regenerate();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(bodyOf(fetchSpy, 0)).toEqual({
            conversationId: 'c1',
            action: 'regenerate',
        });
    });

    it('HTTP 단계 실패 뒤 retry는 같은 이미지로 다시 보낸다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                Response.json({ error: 'server_busy' }, { status: 503 })
            )
            .mockResolvedValueOnce(sse(DONE));
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('', [image('a', 'AAAA')]);
        });
        await waitFor(() => expect(result.current.status).toBe('error'));
        act(() => {
            void result.current.retry();
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(bodyOf(fetchSpy, 1).images).toEqual([
            { mediaType: 'image/jpeg', data: 'AAAA' },
        ]);
        expect(result.current.messages[0]?.images).toHaveLength(1);
    });

    it('edit: 편집한 메시지의 이미지를 낙관적 말풍선에 이어 붙이되 본문에는 싣지 않는다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => sse(DONE));
        const stored: ChatMessageView[] = [
            {
                id: 'u1',
                seq: 1,
                role: 'user',
                content: '이거 어때?',
                toolCalls: null,
                toolName: null,
                status: 'complete',
                createdAt: new Date(2026, 0, 1).toISOString(),
                images: [{ id: 'img-1', width: 10, height: 8 }],
            },
        ];
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: 'c1', initialMessages: stored })
        );
        act(() => {
            void result.current.edit(1, '다시 물어볼게');
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        expect(result.current.messages[0]).toMatchObject({
            content: '다시 물어볼게',
            images: [
                {
                    id: 'img-1',
                    width: 10,
                    height: 8,
                    src: '/api/ai/chat/images/img-1',
                },
            ],
        });
        expect(bodyOf(fetchSpy, 0)).not.toHaveProperty('images');
    });

    it('언마운트하면 방금 첨부한 이미지의 object URL을 놓는다', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => sse(DONE));
        const revoke = vi
            .spyOn(URL, 'revokeObjectURL')
            .mockImplementation(() => {});
        const { result, unmount } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        act(() => {
            void result.current.send('x', [image('a', 'AAAA')]);
        });
        await waitFor(() => expect(result.current.status).toBe('idle'));
        unmount();
        expect(revoke).toHaveBeenCalledWith('blob:a');
    });
});

describe('useAgentStream — 보낸 이미지의 payload 정리', () => {
    const payloadsOf = (messages: readonly AgentUiMessage[]) =>
        messages
            .filter(m => m.role === 'user')
            .map(m => m.images?.map(i => i.payload !== undefined));

    it('회원: 턴이 끝나면 보낸 이미지의 payload를 상태에서 덜어 낸다(src는 유지)', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => sse(DONE));
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        await act(async () => {
            await result.current.send('질문', [image('a', 'AAAA')]);
        });
        expect(result.current.status).toBe('idle');
        expect(payloadsOf(result.current.messages)).toEqual([[false]]);
        expect(result.current.messages[0]?.images?.[0]?.src).toBe('blob:a');
    });

    it('게스트: 마지막 사용자 메시지의 payload만 남기고 앞선 것은 덜어 낸다', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () => sse(DONE));
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        await act(async () => {
            await result.current.send('첫째', [image('a', 'AAAA')]);
        });
        expect(payloadsOf(result.current.messages)).toEqual([[true]]);
        await act(async () => {
            await result.current.send('둘째', [image('b', 'BBBB')]);
        });
        expect(payloadsOf(result.current.messages)).toEqual([[false], [true]]);
    });

    it('게스트 재생성은 덜어 내지 않은 마지막 질문의 payload를 다시 보낸다', async () => {
        const fetchSpy = vi
            .spyOn(globalThis, 'fetch')
            .mockImplementation(async () => sse(DONE));
        const { result } = renderHook(() =>
            useAgentStream({
                conversationId: null,
                initialMessages: [],
                guest: true,
            })
        );
        await act(async () => {
            await result.current.send('질문', [image('a', 'AAAA')]);
        });
        await act(async () => {
            await result.current.regenerate();
        });
        expect(bodyOf(fetchSpy, 1).images).toEqual([
            { mediaType: 'image/jpeg', data: 'AAAA' },
        ]);
    });
});

describe('useAgentStream — 롤백된 첨부의 blob URL', () => {
    it('HTTP 오류로 롤백된 첨부는 새 제출이 덮을 때 놓는다', async () => {
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                Response.json({ error: 'server_busy' }, { status: 409 })
            )
            .mockImplementation(async () => sse(DONE));
        const revoke = vi
            .spyOn(URL, 'revokeObjectURL')
            .mockImplementation(() => {});
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        await act(async () => {
            await result.current.send('질문', [image('a', 'AAAA')]);
        });
        expect(revoke).not.toHaveBeenCalled();
        await act(async () => {
            await result.current.send('다른 질문', [image('b', 'BBBB')]);
        });
        expect(revoke).toHaveBeenCalledWith('blob:a');
        expect(revoke).not.toHaveBeenCalledWith('blob:b');
    });

    it('retry가 같은 첨부를 다시 보낼 때는 놓지 않는다', async () => {
        vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(
                Response.json({ error: 'server_busy' }, { status: 409 })
            )
            .mockImplementation(async () => sse(DONE));
        const revoke = vi
            .spyOn(URL, 'revokeObjectURL')
            .mockImplementation(() => {});
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        await act(async () => {
            await result.current.send('질문', [image('a', 'AAAA')]);
        });
        await act(async () => {
            await result.current.retry();
        });
        expect(revoke).not.toHaveBeenCalledWith('blob:a');
    });
});

describe('useAgentStream — 이미지 거절 시 글 되돌리기', () => {
    it.each(['invalid_image', 'too_large'] as const)(
        '%s: 사라진 질문의 글을 restoredDraft로 내준다',
        async code => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                Response.json({ error: code }, { status: 400 })
            );
            const { result } = renderHook(() =>
                useAgentStream({ conversationId: null, initialMessages: [] })
            );
            expect(result.current.restoredDraft).toBeNull();
            await act(async () => {
                await result.current.send('이 차트 어때?', [
                    image('a', 'AAAA'),
                ]);
            });
            expect(result.current.error).toBe(code);
            expect(result.current.messages).toEqual([]);
            expect(result.current.restoredDraft).toEqual({
                id: 1,
                text: '이 차트 어때?',
            });
        }
    );

    it.each(['invalid_image', 'too_large'] as const)(
        '%s: 롤백된 말풍선의 blob URL을 놓는다',
        async code => {
            vi.spyOn(globalThis, 'fetch').mockResolvedValue(
                Response.json({ error: code }, { status: 400 })
            );
            const revoke = vi
                .spyOn(URL, 'revokeObjectURL')
                .mockImplementation(() => {});
            const { result } = renderHook(() =>
                useAgentStream({ conversationId: null, initialMessages: [] })
            );
            await act(async () => {
                await result.current.send('질문', [
                    image('a', 'AAAA'),
                    image('b', 'BBBB'),
                ]);
            });
            expect(revoke).toHaveBeenCalledWith('blob:a');
            expect(revoke).toHaveBeenCalledWith('blob:b');
        }
    );

    it('다른 HTTP 오류는 blob URL을 놓지 않는다(retry가 같은 첨부를 다시 그린다)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({ error: 'server_busy' }, { status: 409 })
        );
        const revoke = vi
            .spyOn(URL, 'revokeObjectURL')
            .mockImplementation(() => {});
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        await act(async () => {
            await result.current.send('질문', [image('a', 'AAAA')]);
        });
        expect(revoke).not.toHaveBeenCalled();
    });

    it('같은 글이 다시 거절되면 id를 올려 다시 되돌린다', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
            Response.json({ error: 'invalid_image' }, { status: 400 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        await act(async () => {
            await result.current.send('질문', [image('a', 'AAAA')]);
        });
        await act(async () => {
            await result.current.send('질문', [image('b', 'BBBB')]);
        });
        expect(result.current.restoredDraft).toEqual({ id: 2, text: '질문' });
    });

    it('다른 HTTP 오류는 글을 되돌리지 않는다(다시 시도 버튼이 같은 질문을 보낸다)', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            Response.json({ error: 'server_busy' }, { status: 409 })
        );
        const { result } = renderHook(() =>
            useAgentStream({ conversationId: null, initialMessages: [] })
        );
        await act(async () => {
            await result.current.send('질문', [image('a', 'AAAA')]);
        });
        expect(result.current.error).toBe('server_busy');
        expect(result.current.restoredDraft).toBeNull();
    });
});
