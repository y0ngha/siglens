const actions = vi.hoisted(() => ({ submit: vi.fn(), update: vi.fn() }));
vi.mock('@/entities/feedback/actions/submitAiFeedbackAction', () => ({
    submitAiFeedbackAction: actions.submit,
}));
vi.mock('@/entities/feedback/actions/updateAiFeedbackAction', () => ({
    updateAiFeedbackAction: actions.update,
}));
vi.mock('@/entities/ticker/actions/getAssetLabelsAction', () => ({
    getAssetLabelsAction: vi.fn(async () => ({ labels: {}, failed: [] })),
}));

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import { MessageList } from '@/widgets/agent-chat/MessageList';

const UUID_1 = '7b1d6a52-0000-4000-8000-000000000001';
const UUID_2 = '7b1d6a52-0000-4000-8000-000000000002';

function message(
    partial: Partial<AgentUiMessage> & Pick<AgentUiMessage, 'id' | 'role'>
): AgentUiMessage {
    return { content: '', tools: [], status: 'complete', ...partial };
}

const DONE_CONVERSATION: AgentUiMessage[] = [
    message({ id: 'u1', role: 'user', content: '애플 어때?', seq: 1 }),
    message({ id: UUID_1, role: 'assistant', content: '상승 추세입니다.' }),
    message({ id: 'u2', role: 'user', content: '테슬라는?', seq: 3 }),
    message({ id: UUID_2, role: 'assistant', content: '횡보 중입니다.' }),
];

function renderList(
    messages: AgentUiMessage[],
    extra: {
        streaming?: boolean;
        conversationId?: string | null;
        guest?: boolean;
    } = {}
) {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <MessageList
                messages={messages}
                streaming={extra.streaming ?? false}
                onRegenerate={vi.fn()}
                onEdit={vi.fn()}
                onSend={vi.fn()}
                siteUrl="https://siglens.io"
                localePrefix=""
                conversationId={extra.conversationId}
                guest={extra.guest}
            />
        </QueryClientProvider>
    );
}

const upButtons = () =>
    screen.queryAllByRole('button', { name: '도움이 됐어요' });

describe('MessageList 👍/👎', () => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    afterAll(() => {
        Element.prototype.scrollIntoView = originalScrollIntoView;
    });
    beforeEach(() => {
        vi.clearAllMocks();
        actions.submit.mockResolvedValue({ ok: true, id: 'fb-1' });
        actions.update.mockResolvedValue({ ok: true });
    });

    it('끝난 답변마다 붙고 질문에는 붙지 않는다', () => {
        renderList(DONE_CONVERSATION);

        expect(upButtons()).toHaveLength(2);
        const userTurns = screen
            .getAllByRole('article')
            .filter(a => a.getAttribute('data-role') !== 'assistant');
        for (const turn of userTurns) {
            expect(
                within(turn).queryByRole('button', { name: '도움이 됐어요' })
            ).not.toBeInTheDocument();
        }
    });

    it('스트리밍 중에도 앞선 끝난 답변에는 남고 스트리밍 답변에는 붙지 않는다', () => {
        renderList(
            [
                ...DONE_CONVERSATION.slice(0, 3),
                message({
                    id: 'pending-1-1',
                    role: 'assistant',
                    content: '횡보',
                    status: 'streaming',
                }),
            ],
            { streaming: true }
        );

        expect(upButtons()).toHaveLength(1);
        const streamingTurn = screen
            .getAllByRole('article')
            .filter(a => a.getAttribute('data-role') === 'assistant')
            .at(-1)!;
        expect(
            within(streamingTurn).queryByRole('button', {
                name: '도움이 됐어요',
            })
        ).not.toBeInTheDocument();
    });

    it('새 턴이 스트리밍되어도 앞선 답변에 누른 평가가 유지된다', async () => {
        const user = userEvent.setup();
        const view = renderList(DONE_CONVERSATION);
        await user.click(upButtons()[0]!);
        expect(upButtons()[0]).toHaveAttribute('aria-pressed', 'true');

        const streamingList = [
            ...DONE_CONVERSATION,
            message({ id: 'u3', role: 'user', content: '다음?', seq: 5 }),
            message({
                id: 'pending-3-1',
                role: 'assistant',
                content: '...',
                status: 'streaming',
            }),
        ];
        view.rerender(
            <QueryClientProvider client={new QueryClient()}>
                <MessageList
                    messages={streamingList}
                    streaming
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                    onSend={vi.fn()}
                    siteUrl="https://siglens.io"
                    localePrefix=""
                />
            </QueryClientProvider>
        );

        expect(upButtons()[0]).toHaveAttribute('aria-pressed', 'true');
        expect(actions.submit).toHaveBeenCalledTimes(1);
    });

    it.each(['aborted', 'error'] as const)(
        '%s 상태의 답변에는 붙지 않는다',
        status => {
            renderList([
                DONE_CONVERSATION[0]!,
                message({
                    id: UUID_1,
                    role: 'assistant',
                    content: '부분',
                    status,
                }),
            ]);

            expect(upButtons()).toHaveLength(0);
        }
    );

    it('회원 답변은 그 답변까지의 대화 기록과 대화·메시지 id로 저장한다', async () => {
        const user = userEvent.setup();
        renderList(DONE_CONVERSATION, {
            conversationId: 'conv-1',
            guest: false,
        });

        // 첫 답변을 평가한다 - 그 뒤의 질문·답변은 스냅샷에 들어가면 안 된다.
        await user.click(upButtons()[0]!);

        await waitFor(() => expect(actions.submit).toHaveBeenCalledTimes(1));
        expect(actions.submit).toHaveBeenCalledWith({
            surface: 'siglens_ai',
            vote: 'up',
            context: {
                guest: false,
                messageIndex: 1,
                conversationId: 'conv-1',
                messageId: UUID_1,
            },
            snapshot: [
                { role: 'user', content: '애플 어때?' },
                { role: 'assistant', content: '상승 추세입니다.' },
            ],
            pagePath: window.location.pathname,
        });
    });

    it('비회원 답변은 id 없이 guest 표시만 싣는다', async () => {
        const user = userEvent.setup();
        renderList(
            [
                DONE_CONVERSATION[0]!,
                message({
                    id: 'pending-1-2',
                    role: 'assistant',
                    content: '상승 추세입니다.',
                }),
            ],
            { conversationId: null, guest: true }
        );

        await user.click(upButtons()[0]!);

        await waitFor(() => expect(actions.submit).toHaveBeenCalledTimes(1));
        expect(actions.submit.mock.calls[0]![0].context).toEqual({
            guest: true,
            messageIndex: 1,
        });
    });

    it('회원이어도 임시 id인 답변은 messageId를 싣지 않는다', async () => {
        const user = userEvent.setup();
        renderList(
            [
                DONE_CONVERSATION[0]!,
                message({
                    id: 'pending-1-2',
                    role: 'assistant',
                    content: '상승 추세입니다.',
                }),
            ],
            { conversationId: 'conv-1', guest: false }
        );

        await user.click(upButtons()[0]!);

        await waitFor(() => expect(actions.submit).toHaveBeenCalledTimes(1));
        const context = actions.submit.mock.calls[0]![0].context;
        expect(context).not.toHaveProperty('messageId');
        expect(context.conversationId).toBe('conv-1');
    });
});
