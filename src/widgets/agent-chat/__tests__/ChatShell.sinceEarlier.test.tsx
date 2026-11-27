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
const mockStream = vi.hoisted(() => ({
    messages: [] as MockMessage[],
    conversationId: 'c1' as string | null,
    status: 'idle' as 'idle' | 'streaming',
    error: null,
    remaining: null,
    send: vi.fn(),
    regenerate: vi.fn(),
    edit: vi.fn(),
    retry: vi.fn(),
    stop: vi.fn(),
}));
vi.mock('@/features/agent-chat/hooks/useAgentStream', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/features/agent-chat/hooks/useAgentStream')
    >()),
    useAgentStream: () => mockStream,
}));

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
import type { ChatSymbolChanges } from '@/entities/chat-conversation/types';
import { defined } from '@/shared/test-utils/defined';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';
import ko from '../../../../messages/ko.json';

import { ChatShell } from '@/widgets/agent-chat/ChatShell';

interface MockMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    tools: unknown[];
    status: 'complete';
}

const message = (id: string, role: 'user' | 'assistant'): MockMessage => ({
    id,
    role,
    content: role === 'user' ? '엔비디아 분석해 줘' : '분석 결과예요',
    tools: [],
    status: 'complete',
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

function renderShell(
    props: Partial<React.ComponentProps<typeof ChatShell>> = {}
) {
    return render(
        <QueryClientProvider client={new QueryClient()}>
            <NextIntlClientProvider locale="ko" messages={ko}>
                <ChatShell
                    conversationId="c1"
                    initialMessages={[]}
                    conversations={[]}
                    signedIn
                    localePrefix=""
                    siteUrl="https://siglens.io"
                    currentPath="/c/c1"
                    {...props}
                />
            </NextIntlClientProvider>
        </QueryClientProvider>
    );
}

const originalScrollIntoView = Element.prototype.scrollIntoView;
beforeAll(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    // `MessageList`는 지연 청크다 — 미리 적재해 두면 각 테스트가 본문을 바로 찾는다.
    await import('../MessageList');
}, MODULE_LOAD_TIMEOUT_MS);
afterAll(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
});

describe('ChatShell — 다시 연 대화의 "달라진 점" 카드', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStream.conversationId = 'c1';
        mockStream.status = 'idle';
        mockStream.messages = [message('1', 'user'), message('2', 'assistant')];
        action.mockResolvedValue([result]);
    });

    it('저장된 대화를 열면 마지막 메시지 바로 아래에 카드가 붙는다', async () => {
        renderShell();
        const card = await screen.findByRole('region', {
            name: /분석 이후 달라진 점/,
        });
        const log = screen.getByRole('log');
        const turns = [...log.querySelectorAll('article')];
        const last = defined(turns.at(-1), 'last turn');
        expect(
            last.compareDocumentPosition(card) &
                Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(card.closest('[role="log"]')).toBe(log);
        expect(action).toHaveBeenCalledWith('c1');
    });

    it('카드의 질문 버튼은 입력창과 같은 경로(stream.send)로 보낸다', async () => {
        renderShell();
        const card = await screen.findByRole('region', {
            name: /분석 이후 달라진 점/,
        });
        fireEvent.click(within(card).getByRole('button'));
        expect(mockStream.send).toHaveBeenCalledTimes(1);
        expect(mockStream.send).toHaveBeenCalledWith(
            'NVDA(NVDA) 11월 18일 분석 이후 달라진 점을 알려 줘'
        );
    });

    it('새 대화(저장된 대화가 아님)에는 카드도 서버 조회도 없다', async () => {
        renderShell({ conversationId: null });
        await screen.findByRole('log');
        expect(action).not.toHaveBeenCalled();
        expect(screen.queryByRole('region')).toBeNull();
    });

    it('저장된 대화여도 비회원 화면에는 붙지 않는다', async () => {
        renderShell({ signedIn: false });
        await screen.findByRole('log');
        expect(action).not.toHaveBeenCalled();
    });

    it('열 때 메시지가 하나도 없으면 붙을 자리가 없다', async () => {
        mockStream.messages = [];
        renderShell();
        await Promise.resolve();
        expect(action).not.toHaveBeenCalled();
    });
});
