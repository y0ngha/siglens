vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
const { action } = vi.hoisted(() => ({ action: vi.fn() }));
vi.mock(
    '@/entities/chat-conversation/actions/getConversationChangesAction',
    () => ({ getConversationChangesAction: action })
);
vi.mock('@/entities/ticker/actions/getAssetLabelsAction', () => ({
    getAssetLabelsAction: vi.fn(async () => ({ labels: {}, failed: [] })),
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import type { ChatMessageView } from '@/entities/chat-conversation/model';
import type { ChatSymbolChanges } from '@/entities/chat-conversation/types';
import { defined } from '@/shared/test-utils/defined';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';
import { ChatShell } from '@/widgets/agent-chat/ChatShell';
import ko from '../../../../messages/ko.json';

const view = (
    id: string,
    seq: number,
    role: 'user' | 'assistant',
    content: string
): ChatMessageView => ({
    id,
    seq,
    role,
    content,
    toolCalls: null,
    toolName: null,
    status: 'complete',
    createdAt: '2026-11-18T14:00:00.000Z',
});

const result: ChatSymbolChanges = {
    status: 'changes',
    symbol: 'NVDA',
    marketProfile: 'us-equity',
    analyzedAt: '2026-11-18T14:00:00.000Z',
    analyzedDate: '2026-11-18',
    latestDate: '2026-11-25',
    closeThen: 100,
    closeNow: 94,
    items: [],
    hasLevels: true,
    trendMeasured: true,
    trendEmaPeriod: 20,
    unreadDays: 0,
};

const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeAll(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    await import('../MessageList');
}, MODULE_LOAD_TIMEOUT_MS);
afterAll(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
});

/**
 * 카드의 자리(`sinceEarlierAnchorId`)는 `ChatSession`이 첫 렌더에 한 번만 정한다. 그게 맞으려면 저장된 메시지가
 * 첫 렌더에 이미 있어야 한다 — 실제 `useAgentStream`이 `initialMessages`를 첫 렌더에 동기로 시드하는지 여기서 고정한다
 * (나중에 비동기로 채우는 경로가 생기면 이 테스트가 깨진다). 대화를 바꾸면 `/c/[id]` 페이지가 `ChatShell`을
 * `key={conversation.id}`로 새로 만들어 자리도 새로 정해진다.
 */
describe('ChatShell — 카드 자리는 첫 렌더의 저장된 메시지로 정해진다', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        action.mockResolvedValue([result]);
    });

    it('실제 스트림 훅이 저장된 메시지를 첫 렌더에 시드해, 카드가 마지막 메시지 아래에 붙는다', async () => {
        render(
            <QueryClientProvider client={new QueryClient()}>
                <NextIntlClientProvider locale="ko" messages={ko}>
                    <ChatShell
                        conversationId="c1"
                        initialMessages={[
                            view('m1', 1, 'user', '엔비디아 분석해 줘'),
                            view('m2', 2, 'assistant', '분석 결과예요'),
                        ]}
                        conversations={[]}
                        signedIn
                        localePrefix=""
                        siteUrl="https://siglens.io"
                        currentPath="/c/c1"
                    />
                </NextIntlClientProvider>
            </QueryClientProvider>
        );
        const card = await screen.findByRole('region', {
            name: /분석 이후 달라진 점/,
        });
        const turns = [...screen.getByRole('log').querySelectorAll('article')];
        const last = defined(turns.at(-1), 'last turn');
        expect(last).toHaveTextContent('분석 결과예요');
        expect(
            last.compareDocumentPosition(card) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(action).toHaveBeenCalledWith('c1');
    });
});
