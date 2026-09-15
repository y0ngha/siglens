import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { AGENT_ERROR_CODES } from '@/features/agent-chat';
import ko from '../../../../messages/ko.json';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const mockStream = vi.hoisted(() => ({
    messages: [
        {
            id: '1',
            role: 'user' as const,
            content: 'q',
            tools: [],
            status: 'complete' as const,
        },
    ],
    conversationId: 'c1',
    status: 'idle' as 'idle' | 'streaming' | 'error',
    error: null as string | null,
    remaining: null,
    send: vi.fn(),
    regenerate: vi.fn(),
    edit: vi.fn(),
    retry: vi.fn(),
    stop: vi.fn(),
}));
/** Captures what ChatShell passes in, so a test can fire `onConversationCreated` itself. */
const captured = vi.hoisted(
    () =>
        ({ options: null }) as {
            options: {
                onConversationCreated?: (id: string, title: string) => void;
                guest?: boolean;
            } | null;
        }
);
vi.mock('@/features/agent-chat', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@/features/agent-chat')>();
    return {
        ...actual,
        useAgentStream: (options: typeof captured.options) => {
            captured.options = options;
            return mockStream;
        },
    };
});

import { ChatShell } from '@/widgets/agent-chat/ChatShell';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

// A fresh element each call: passing the SAME element reference to `rerender`
// makes React bail out of re-rendering the subtree, so the effect under test
// never sees the new status.
const shellTree = () => (
    <ChatShell
        conversationId="c1"
        initialMessages={[]}
        conversations={[]}
        signedIn
        localePrefix=""
        siteUrl="https://siglens.io"
        currentPath="/c1"
    />
);

function renderShell() {
    return wrap(shellTree());
}

describe('ChatShell error banner', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    beforeEach(() => {
        mockStream.send.mockClear();
        mockStream.regenerate.mockClear();
        mockStream.edit.mockClear();
        mockStream.retry.mockClear();
        mockStream.stop.mockClear();
    });

    it('shows a non-empty, distinct message for every HTTP-stage and turn-stage code', () => {
        const seen = new Set<string>();
        for (const code of AGENT_ERROR_CODES) {
            if (code === 'unauthenticated') continue; // redirects instead of rendering a banner
            mockStream.error = code;
            const { unmount } = renderShell();
            const alert = screen.getByRole('alert');
            expect(
                alert.textContent,
                `empty message for code "${code}"`
            ).not.toBe('');
            seen.add(alert.textContent!.replace(/재시도$/, ''));
            unmount();
        }
        expect(seen.size).toBe(AGENT_ERROR_CODES.length - 1);
    });

    it('renders no banner and no retry for unauthenticated (redirect instead)', () => {
        mockStream.error = 'unauthenticated';
        renderShell();
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('shows a retry button only for retryable codes', () => {
        mockStream.error = 'server_busy';
        const { unmount } = renderShell();
        expect(
            screen.getByRole('button', { name: /재시도/ })
        ).toBeInTheDocument();
        unmount();

        mockStream.error = 'turn_limit';
        renderShell();
        expect(screen.queryByRole('button', { name: /재시도/ })).toBeNull();
    });

    it('guest: the composer is open, the stream runs in guest mode, and a spent daily quota offers login instead of retry', () => {
        mockStream.error = 'turn_limit';
        wrap(
            <ChatShell
                conversationId={null}
                initialMessages={[]}
                conversations={[]}
                signedIn={false}
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/"
            />
        );
        expect(captured.options).toMatchObject({ guest: true });
        expect(screen.getByRole('textbox')).toBeEnabled();
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('비회원은 하루 10번까지');
        expect(screen.queryByRole('button', { name: /재시도/ })).toBeNull();
        const logins = screen.getAllByRole('link', { name: '로그인' });
        // The banner CTA plus the "not saved" notice above the composer.
        expect(logins).toHaveLength(2);
        logins.forEach(a =>
            expect(a.getAttribute('href')).toMatch(
                /^https:\/\/siglens\.io\/login\?next=/
            )
        );
        expect(
            screen.getByText('비회원 대화는 저장되지 않아요.')
        ).toBeInTheDocument();
    });

    it('the banner retry button calls stream.retry(), never stream.regenerate() directly', () => {
        mockStream.error = 'server_busy';
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: /재시도/ }));
        expect(mockStream.retry).toHaveBeenCalledTimes(1);
        expect(mockStream.regenerate).not.toHaveBeenCalled();
    });
});

describe('ChatShell new-conversation list update', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    beforeEach(() => {
        router.refresh.mockClear();
        captured.options = null;
        mockStream.error = null;
        mockStream.status = 'idle';
    });

    /**
     * `/c/[id]` is a different route segment than the page that rendered this shell,
     * so any `router.refresh()` swaps in that tree — its `loading.tsx` skeleton
     * flashes over the conversation already on screen, and mid-stream it would also
     * abort the turn. The new conversation must reach the sidebar (and the header
     * title) from the stream event alone, with no refresh at any point.
     */
    it('adds the created conversation to the sidebar without refreshing', () => {
        mockStream.status = 'streaming';
        mockStream.conversationId = 'c2';
        const { rerender } = renderShell();
        act(() => {
            captured.options?.onConversationCreated?.('c2', '새 대화 제목');
        });
        expect(window.location.pathname).toBe('/c/c2');
        expect(
            screen.getAllByRole('link', { name: '새 대화 제목' }).length
        ).toBeGreaterThan(0);

        mockStream.status = 'idle';
        rerender(
            <NextIntlClientProvider locale="ko" messages={ko}>
                {shellTree()}
            </NextIntlClientProvider>
        );
        // Regression guard: a prior version called router.refresh() here, which
        // swapped in the /c/[id] tree and flashed its loading skeleton.
        expect(router.refresh).not.toHaveBeenCalled();
        mockStream.conversationId = 'c1';
    });
});

/**
 * Task S3: the ai host now renders the shared main `Header` above this
 * shell (`AuthSessionHeaderClient`), so `ChatShell` itself must not draw a
 * second one — that was the old `AiHeader`'s `<header>` element, now removed
 * in favor of a `lg:hidden` bar that only opens the mobile conversation
 * drawer.
 */
describe('ChatShell chrome', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    beforeEach(() => {
        mockStream.error = null;
        mockStream.status = 'idle';
    });

    it('renders no header landmark of its own (the shared Header owns that)', () => {
        renderShell();
        expect(screen.queryByRole('banner')).toBeNull();
    });

    it('the mobile bar opens the sidebar drawer', () => {
        renderShell();
        const trigger = screen.getByRole('button', {
            name: /대화 목록/,
        });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        // vaul renders `Drawer.Content` into a portal once open; assert the
        // drawer's own (sr-only) title becomes reachable rather than relying
        // on any particular internal vaul DOM structure.
        expect(screen.getAllByText('대화 목록').length).toBeGreaterThanOrEqual(
            2
        ); // mobile-bar button label + drawer title
    });

    it('clicking a conversation link in the mobile drawer navigates and closes the drawer', () => {
        router.push.mockClear();
        wrap(
            <ChatShell
                conversationId="c1"
                initialMessages={[]}
                conversations={[
                    { id: 'c9', title: '대화 아홉', lastMessageAt: '' },
                ]}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/c1"
            />
        );
        const trigger = screen.getByRole('button', { name: /대화 목록/ });
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        // Scope to the drawer's own content, not the desktop `aside` copy of
        // the same rail — both render the link, but only the drawer's is the
        // one under test here.
        const drawer = document.getElementById('agent-chat-sidebar-drawer')!;
        const link = within(drawer).getByRole('link', { name: '대화 아홉' });
        fireEvent.click(link, { button: 0 });
        expect(router.push).toHaveBeenCalledWith('/c/c9');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
});

/**
 * Task S4: `suggestions` must reach `EmptyState` unchanged so the
 * AI-generated questions render as pickable buttons instead of the static
 * fallback six.
 */
describe('ChatShell suggestions passthrough (Task S4)', () => {
    const originalMessages = mockStream.messages;
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    beforeEach(() => {
        mockStream.error = null;
        mockStream.status = 'idle';
        // EmptyState only renders once the transcript is empty.
        mockStream.messages = [];
    });
    afterEach(() => {
        mockStream.messages = originalMessages;
    });

    it('renders the AI-generated suggestions as buttons', async () => {
        await act(async () => {
            wrap(
                <ChatShell
                    conversationId="c1"
                    initialMessages={[]}
                    conversations={[]}
                    signedIn
                    localePrefix=""
                    siteUrl="https://siglens.io"
                    currentPath="/c1"
                    suggestions={Promise.resolve(['질문 하나', '질문 둘'])}
                />
            );
        });
        expect(
            await screen.findByRole('button', { name: /질문 하나/ })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /질문 둘/ })
        ).toBeInTheDocument();
    });
});
