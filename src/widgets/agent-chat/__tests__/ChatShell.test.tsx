import {
    act,
    fireEvent,
    render,
    screen,
    waitFor,
    within,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { AGENT_ERROR_CODES } from '@/features/agent-chat/lib/errorCodes';
import { BELOW_LG_MEDIA_QUERY } from '@/shared/config/viewport';
import { MODULE_LOAD_TIMEOUT_MS } from '@/shared/test-utils/testTimeouts';
import ko from '../../../../messages/ko.json';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
// The Sidebar rendered by ChatShell is real (not mocked) — its rename/delete
// forms call these server actions directly, so they're stubbed here the same
// way Sidebar.test.tsx stubs them.
const { deleteConversationAction, renameConversationAction } = vi.hoisted(
    () => ({
        deleteConversationAction: vi.fn(async () => ({ ok: true })),
        renameConversationAction: vi.fn(async () => ({ ok: true })),
    })
);
vi.mock(
    '@/entities/chat-conversation/actions/deleteConversationAction',
    () => ({
        deleteConversationAction,
    })
);
vi.mock(
    '@/entities/chat-conversation/actions/renameConversationAction',
    () => ({
        renameConversationAction,
    })
);

interface MockStreamMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    followUps?: readonly string[];
    seq?: number;
    tools: unknown[];
    status: 'complete' | 'streaming' | 'aborted' | 'error';
}

const mockStream = vi.hoisted(() => ({
    messages: [
        {
            id: '1',
            role: 'user',
            content: 'q',
            tools: [],
            status: 'complete',
        },
    ] as MockStreamMessage[],
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
vi.mock('@/features/agent-chat/hooks/useAgentStream', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/features/agent-chat/hooks/useAgentStream')
    >()),
    useAgentStream: (options: typeof captured.options) => {
        captured.options = options;
        return mockStream;
    },
}));

import { ChatShell } from '@/widgets/agent-chat/ChatShell';

// A shared QueryClient across a render+rerender pair: MessageList's
// RelatedPages mounts a `useQuery` for any non-streaming assistant bubble
// with content, so every render pass (initial and rerender alike) needs a
// QueryClientProvider in its tree.
const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
});
const withProviders = (ui: React.ReactElement) => (
    <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    </QueryClientProvider>
);
const wrap = (ui: React.ReactElement) => render(withProviders(ui));

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

// Four separate `describe`s below each patch
// `Element.prototype.scrollIntoView` in their own `beforeAll`/`beforeEach`
// with no restore of their own — captured ONCE here (before any of them
// runs) and restored ONCE after the whole file finishes, so this file
// doesn't leak a stale scrollIntoView stub into a LATER test file running
// in the same worker process.
const originalScrollIntoView = Element.prototype.scrollIntoView;
afterAll(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
});

/**
 * 렌더 → lazy 해소 대기. 모듈을 미리 적재해 보통은 짧지만, 병렬 부하에서의 값을
 * 따로 재지 않았으므로 예전 대기(10초)를 그대로 유지한다.
 */
const LAZY_RESOLVE_WAIT_MS = 10_000;

/**
 * `MessageList`는 `next/dynamic` 지연 청크다(빈 랜딩의 first-load JS에서 빼려고).
 * 파일의 첫 테스트 전에 한 번 받아 두면 — React.lazy가 풀린 결과를 기억한다 — 이후
 * 렌더는 동기라 각 테스트가 본문을 곧바로 찾을 수 있다. 테스트 순서에 기대지 않으려고
 * 여기서 명시적으로 데운다.
 *
 * 무거운 모듈 적재는 `findByRole` 폴링 밖에서 먼저 끝낸다 — 같은 모듈 캐시라
 * `dynamic()`의 `import('./MessageList')`는 이미 평가된 모듈을 받는다. 예전엔
 * `MessageList` 그래프(react-markdown 포함)의 첫 변환·평가를 `findByRole`의 10초
 * 대기 안에서 치렀고, 병렬 전체 실행에서 그걸 넘겨 파일 전체가 실패했다(이후
 * 케이스 34개가 통째로 skip, 2026-10-06).
 */
beforeAll(async () => {
    Element.prototype.scrollIntoView = vi.fn();
    await import('../MessageList');
    const { unmount } = renderShell();
    await screen.findByRole('log', {}, { timeout: LAZY_RESOLVE_WAIT_MS });
    unmount();
}, MODULE_LOAD_TIMEOUT_MS);

/** `lg` 미만으로 보이게 한다 — 모바일 서랍(vaul)은 그때만 불러온다. */
const originalMatchMedia = Object.getOwnPropertyDescriptor(
    window,
    'matchMedia'
);
function stubBelowLg(belowLg: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
            matches: query === BELOW_LG_MEDIA_QUERY ? belowLg : false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
        }),
    });
}
function restoreMatchMedia(): void {
    if (originalMatchMedia)
        Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    else Reflect.deleteProperty(window, 'matchMedia');
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
        rerender(withProviders(shellTree()));
        // Regression guard: a prior version called router.refresh() here, which
        // swapped in the /c/[id] tree and flashed its loading skeleton.
        expect(router.refresh).not.toHaveBeenCalled();
        mockStream.conversationId = 'c1';
    });

    it('prepends the new conversation ahead of the existing ones, de-duplicating by id', () => {
        mockStream.status = 'streaming';
        mockStream.conversationId = 'c2';
        wrap(
            <ChatShell
                conversationId="c2"
                initialMessages={[]}
                conversations={[
                    { id: 'c1', title: '기존 대화', lastMessageAt: '' },
                    { id: 'c2', title: '오래된 제목', lastMessageAt: '' },
                ]}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/c2"
            />
        );
        act(() => {
            captured.options?.onConversationCreated?.('c2', '새 제목');
        });
        // "c2" already existed under a stale title — the event replaces it
        // rather than adding a duplicate row, and "기존 대화" (c1) survives.
        expect(
            screen.getAllByRole('link', { name: '새 제목' }).length
        ).toBeGreaterThan(0);
        expect(screen.queryByText('오래된 제목')).toBeNull();
        expect(
            screen.getAllByRole('link', { name: '기존 대화' }).length
        ).toBeGreaterThan(0);
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
        stubBelowLg(true);
    });
    afterEach(() => {
        restoreMatchMedia();
    });

    /** vaul 서랍은 지연 청크라 열린 뒤 한 박자 늦게 붙는다. */
    const findDrawer = (): Promise<HTMLElement> =>
        waitFor(() => {
            const drawer = document.getElementById('agent-chat-sidebar-drawer');
            expect(drawer).not.toBeNull();
            return drawer!;
        });

    it('renders no header landmark of its own (the shared Header owns that)', () => {
        renderShell();
        expect(screen.queryByRole('banner')).toBeNull();
    });

    it('the mobile bar opens the sidebar drawer', async () => {
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
        await waitFor(() =>
            expect(
                screen.getAllByText('대화 목록').length
            ).toBeGreaterThanOrEqual(2)
        ); // mobile-bar button label + drawer title
    });

    it('데스크톱(lg 이상)에서는 vaul 서랍을 불러오지도 그리지도 않는다', async () => {
        stubBelowLg(false);
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: /대화 목록/ }));
        // 지연 청크가 붙을 틈을 준 뒤에도 서랍이 없어야 한다.
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 0));
        });
        expect(document.getElementById('agent-chat-sidebar-drawer')).toBeNull();
    });

    it('서랍이 열린 채 lg 이상으로 넓어지면 닫힌다 (다시 좁혀도 저절로 열리지 않는다)', async () => {
        const listeners = new Set<() => void>();
        let belowLg = true;
        Object.defineProperty(window, 'matchMedia', {
            configurable: true,
            writable: true,
            value: (query: string) => ({
                get matches() {
                    return query === BELOW_LG_MEDIA_QUERY ? belowLg : false;
                },
                media: query,
                addEventListener: (_: string, fn: () => void) =>
                    listeners.add(fn),
                removeEventListener: (_: string, fn: () => void) =>
                    listeners.delete(fn),
            }),
        });
        const resize = (next: boolean): void => {
            belowLg = next;
            for (const fn of listeners) fn();
        };
        renderShell();
        const trigger = screen.getByRole('button', { name: /대화 목록/ });
        fireEvent.click(trigger);
        await findDrawer();

        act(() => resize(false));
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById('agent-chat-sidebar-drawer')).toBeNull();

        act(() => resize(true));
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(document.getElementById('agent-chat-sidebar-drawer')).toBeNull();
    });

    /** The drawer is non-modal, so vaul itself ignores outside presses (2026-09-15 사용자 요청). */
    it('closes the mobile drawer when the user presses outside it', async () => {
        wrap(
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
        const trigger = screen.getByRole('button', { name: /대화 목록/ });
        fireEvent.pointerDown(trigger);
        fireEvent.click(trigger);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        const drawer = await findDrawer();
        // vaul starts a drag on pointerdown inside the drawer and captures the
        // pointer; jsdom has no pointer capture API.
        drawer.setPointerCapture = vi.fn();
        drawer.releasePointerCapture = vi.fn();
        fireEvent.pointerDown(drawer);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');

        fireEvent.pointerDown(document.body);
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('clicking a conversation link in the mobile drawer navigates and closes the drawer', async () => {
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
        const drawer = await findDrawer();
        const link = within(drawer).getByRole('link', { name: '대화 아홉' });
        fireEvent.click(link, { button: 0 });
        expect(router.push).toHaveBeenCalledWith('/c/c9');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
});

/**
 * 대화 전환 골격. 사이드바의 이동은 서버가 다음 대화를 보낼 때까지 커밋되지 않는데,
 * 그동안 본문에 떠나온 대화가 남아 있었다. 이동이 끝나지 않게 `router.push`를 대기
 * 상태로 두고, 그 사이 본문이 골격으로 바뀌는지 본다.
 */
describe('ChatShell — 대화 전환 골격', () => {
    /**
     * 끝나지 않은 이동은 테스트가 끝날 때 반드시 끝낸다. React는 진행 중인 비동기
     * 전환을 한데 묶어(entangle) 전부 끝나야 `isPending`을 내리므로, 남겨 두면 다음
     * 테스트의 이동도 영영 끝나지 않는다.
     */
    const unfinished: Array<() => void> = [];
    function holdNavigation(): () => void {
        let finish: () => void = () => {};
        router.push.mockImplementationOnce(
            () =>
                new Promise<void>(resolve => {
                    finish = resolve;
                })
        );
        const release = () => finish();
        unfinished.push(release);
        return release;
    }
    afterEach(async () => {
        await act(async () => {
            unfinished.splice(0).forEach(release => release());
        });
    });

    function renderShell() {
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
                currentPath="/c/c1"
            />
        );
    }
    const desktopRail = () => document.querySelector('aside') as HTMLElement;
    const skeleton = () =>
        document.querySelector('[data-conversation-skeleton]');

    it('다른 대화를 누르면 도착 전까지 본문을 골격으로 바꾼다', () => {
        holdNavigation();
        renderShell();
        expect(skeleton()).toBeNull();

        fireEvent.click(
            within(desktopRail()).getByRole('link', { name: '대화 아홉' }),
            { button: 0 }
        );

        expect(skeleton()).not.toBeNull();
        expect(screen.queryByRole('log')).toBeNull();
    });

    it('지금 열린 대화를 다시 누르면 골격을 그리지 않는다', () => {
        holdNavigation();
        wrap(
            <ChatShell
                conversationId="c9"
                initialMessages={[]}
                conversations={[
                    { id: 'c9', title: '대화 아홉', lastMessageAt: '' },
                ]}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/c/c9"
            />
        );

        fireEvent.click(
            within(desktopRail()).getByRole('link', { name: '대화 아홉' }),
            { button: 0 }
        );

        expect(skeleton()).toBeNull();
    });

    it('새 대화로 가는 이동에는 골격을 그리지 않는다', () => {
        holdNavigation();
        renderShell();

        const newChat = within(desktopRail())
            .getAllByRole('link')
            .find(link => link.getAttribute('href') === '/');
        expect(newChat).toBeDefined();
        fireEvent.click(newChat as HTMLElement, { button: 0 });

        expect(skeleton()).toBeNull();
    });

    it('이동이 끝나면 골격을 걷는다', async () => {
        const finish = holdNavigation();
        renderShell();
        fireEvent.click(
            within(desktopRail()).getByRole('link', { name: '대화 아홉' }),
            { button: 0 }
        );
        expect(skeleton()).not.toBeNull();

        await act(async () => {
            finish();
        });

        await waitFor(() => expect(skeleton()).toBeNull());
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

    /** `requestIdleCallback`/`cancelIdleCallback`을 갈아 끼우고 예약 호출을 돌려준다. */
    function withIdleStub(run: (idle: ReturnType<typeof vi.fn>) => void): void {
        const originalIdle = window.requestIdleCallback;
        const originalCancel = window.cancelIdleCallback;
        const idle = vi.fn(() => 1);
        window.requestIdleCallback = idle as unknown as typeof originalIdle;
        window.cancelIdleCallback = vi.fn();
        try {
            run(idle);
        } finally {
            window.requestIdleCallback = originalIdle;
            window.cancelIdleCallback = originalCancel;
        }
    }

    it('빈 랜딩은 본문 청크를 유휴 시간에 미리 받아 둔다 (첫 전송 때 빈 자리 없음)', () => {
        withIdleStub(idle => {
            renderShell();
            expect(idle).toHaveBeenCalledTimes(1);
        });
    });

    it('대화가 이미 있으면 미리 받기를 예약하지 않는다', () => {
        mockStream.messages = originalMessages;
        withIdleStub(idle => {
            renderShell();
            expect(idle).not.toHaveBeenCalled();
        });
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

/**
 * spec §3.9: `MessageList` is keyed off the route-level `conversationId`
 * PROP (not `stream.conversationId`, which mutates mid-turn on a brand-new
 * chat's first send — see the comment in `ChatShell.tsx`) so a navigation
 * to a DIFFERENT conversation remounts the transcript and its mount-only
 * "jump to bottom instantly" effect fires again.
 */
describe('ChatShell — MessageList key (spec §3.9)', () => {
    const originalMessages = mockStream.messages;
    let scrollIntoViewSpy: ReturnType<typeof vi.fn>;
    beforeAll(() => {
        const spy = vi.fn();
        scrollIntoViewSpy = spy;
        Element.prototype.scrollIntoView =
            spy as unknown as typeof Element.prototype.scrollIntoView;
    });
    beforeEach(() => {
        mockStream.error = null;
        mockStream.status = 'idle';
        mockStream.messages = [
            {
                id: '1',
                role: 'user' as const,
                content: 'q',
                tools: [],
                status: 'complete' as const,
            },
        ];
    });
    afterEach(() => {
        mockStream.messages = originalMessages;
        // The `stream.conversationId만 바뀌는...` test below mutates this
        // shared hoisted mock directly — restore it explicitly rather than
        // relying on that test happening to leave it
        // at the same value the module-level mock started with.
        mockStream.conversationId = 'c1';
    });

    it('clicking a suggestion in EmptyState sends it through the stream', async () => {
        mockStream.messages = [];
        mockStream.send.mockClear();
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
                    suggestions={Promise.resolve(['질문 하나'])}
                />
            );
        });
        const suggestion = await screen.findByRole('button', {
            name: /질문 하나/,
        });
        fireEvent.click(suggestion);
        expect(mockStream.send).toHaveBeenCalledWith('질문 하나');
    });

    it('the regenerate button on the last assistant answer calls stream.regenerate (never edit)', () => {
        mockStream.messages = [
            {
                id: '1',
                role: 'user' as const,
                content: 'q',
                tools: [],
                status: 'complete' as const,
            },
            {
                id: '2',
                role: 'assistant' as const,
                content: 'a',
                tools: [],
                status: 'complete' as const,
            },
        ];
        mockStream.status = 'idle';
        mockStream.regenerate.mockClear();
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: '다시 생성' }));
        expect(mockStream.regenerate).toHaveBeenCalledTimes(1);
        expect(mockStream.edit).not.toHaveBeenCalled();
    });

    it('clicking a follow-up chip under the last answer sends it through the stream (same path as the composer)', () => {
        mockStream.messages = [
            {
                id: '1',
                role: 'user' as const,
                content: 'q',
                tools: [],
                status: 'complete' as const,
            },
            {
                id: '2',
                role: 'assistant' as const,
                // 서버가 마커 줄을 떼어 `followUps`로 넘긴 모양(`useAgentStream`).
                content: '답변입니다.',
                followUps: ['실적은 어때?', '뉴스도 알려줘'],
                tools: [],
                status: 'complete' as const,
            },
        ];
        mockStream.status = 'idle';
        mockStream.send.mockClear();
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: '뉴스도 알려줘' }));
        expect(mockStream.send).toHaveBeenCalledTimes(1);
        expect(mockStream.send).toHaveBeenCalledWith('뉴스도 알려줘');
    });

    it('editing the last user message and submitting calls stream.edit with its seq and new text', () => {
        mockStream.messages = [
            {
                id: '1',
                role: 'user' as const,
                content: '원래 질문',
                seq: 3,
                tools: [],
                status: 'complete' as const,
            },
        ];
        mockStream.status = 'idle';
        mockStream.edit.mockClear();
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: '수정' }));
        const textarea = screen.getByLabelText('메시지 수정');
        fireEvent.change(textarea, { target: { value: '수정된 질문' } });
        fireEvent.submit(textarea.closest('form')!);
        expect(mockStream.edit).toHaveBeenCalledWith(3, '수정된 질문');
    });

    it('submitting the composer sends the typed text through the stream', () => {
        mockStream.messages = [
            {
                id: '1',
                role: 'user' as const,
                content: 'q',
                tools: [],
                status: 'complete' as const,
            },
        ];
        mockStream.status = 'idle';
        mockStream.send.mockClear();
        renderShell();
        const textarea = screen.getByRole('textbox');
        fireEvent.change(textarea, { target: { value: '새 메시지' } });
        fireEvent.keyDown(textarea, { key: 'Enter' });
        expect(mockStream.send).toHaveBeenCalledWith('새 메시지');
    });

    it('conversationId prop이 바뀌면 MessageList가 리마운트되어 다시 맨 아래로 점프한다', () => {
        const { rerender } = wrap(
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
        expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'end' });
        scrollIntoViewSpy.mockClear();

        rerender(
            withProviders(
                <ChatShell
                    conversationId="c2"
                    initialMessages={[]}
                    conversations={[]}
                    signedIn
                    localePrefix=""
                    siteUrl="https://siglens.io"
                    currentPath="/c2"
                />
            )
        );
        // Remounted → the mount-only effect fires again.
        expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'end' });
    });

    it('stream.conversationId만 바뀌는 경우(새 대화 첫 전송)는 리마운트하지 않는다', () => {
        mockStream.conversationId = null as unknown as string;
        const { rerender } = wrap(
            <ChatShell
                conversationId={null}
                initialMessages={[]}
                conversations={[]}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/"
            />
        );
        scrollIntoViewSpy.mockClear();
        // The SSE `meta` frame assigns `stream.conversationId` mid-turn —
        // the ChatShell `conversationId` PROP (route-level) is unchanged.
        mockStream.conversationId = 'c1';
        rerender(
            withProviders(
                <ChatShell
                    conversationId={null}
                    initialMessages={[]}
                    conversations={[]}
                    signedIn
                    localePrefix=""
                    siteUrl="https://siglens.io"
                    currentPath="/"
                />
            )
        );
        expect(scrollIntoViewSpy).not.toHaveBeenCalled();
    });
});

/**
 * The sidebar list is client state ChatShell owns (`conversationItems`), not
 * re-read from the server — `onRenamed`/`onDeleted` (passed to the real,
 * unmocked `Sidebar`) are what keep it in sync with the rename/delete forms
 * the rail actually renders.
 */
describe('ChatShell sidebar rename/delete wiring', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    beforeEach(() => {
        mockStream.error = null;
        mockStream.status = 'idle';
        router.push.mockClear();
        deleteConversationAction.mockClear();
        renameConversationAction.mockClear();
    });

    const conversations = [
        { id: 'c1', title: 'Old title', lastMessageAt: '2026-01-01' },
        { id: 'c9', title: 'Other chat', lastMessageAt: '2026-01-02' },
    ];

    /** Grouping sorts rows by `lastMessageAt`, not by list order — locate a row by its title instead of assuming a position. */
    function rowFor(title: string): HTMLElement {
        return screen.getByRole('link', { name: title }).closest('li')!;
    }

    it('renaming the active conversation updates both the rail entry and the mobile-bar title', async () => {
        mockStream.conversationId = 'c1';
        wrap(
            <ChatShell
                conversationId="c1"
                initialMessages={[]}
                conversations={conversations}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/c1"
            />
        );
        fireEvent.click(
            within(rowFor('Old title')).getByRole('button', {
                name: '이름 변경',
            })
        );
        const input = screen.getByRole('textbox', { name: '대화 이름' });
        fireEvent.change(input, { target: { value: 'New title' } });
        await act(async () => {
            fireEvent.submit(input);
        });
        expect(renameConversationAction).toHaveBeenCalledWith(
            'c1',
            'New title'
        );
        expect(
            screen.getAllByRole('link', { name: 'New title' }).length
        ).toBeGreaterThan(0);
        expect(screen.queryByText('Old title')).toBeNull();
        mockStream.conversationId = 'c1';
    });

    it('renaming rolls back the rail entry when the server refuses it', async () => {
        renameConversationAction.mockResolvedValueOnce({ ok: false });
        mockStream.conversationId = 'c1';
        wrap(
            <ChatShell
                conversationId="c1"
                initialMessages={[]}
                conversations={conversations}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/c1"
            />
        );
        fireEvent.click(
            within(rowFor('Old title')).getByRole('button', {
                name: '이름 변경',
            })
        );
        const input = screen.getByRole('textbox', { name: '대화 이름' });
        fireEvent.change(input, { target: { value: 'New title' } });
        await act(async () => {
            fireEvent.submit(input);
        });
        expect(
            screen.getAllByRole('link', { name: 'Old title' }).length
        ).toBeGreaterThan(0);
        expect(screen.queryByText('New title')).toBeNull();
        mockStream.conversationId = 'c1';
    });

    it('deleting a conversation that is not the active one removes it from the rail without navigating', async () => {
        mockStream.conversationId = 'c1';
        wrap(
            <ChatShell
                conversationId="c1"
                initialMessages={[]}
                conversations={conversations}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/c1"
            />
        );
        fireEvent.click(
            within(rowFor('Other chat')).getByRole('button', { name: '삭제' })
        );
        const confirmButtons = within(rowFor('Other chat')).getAllByRole(
            'button',
            { name: '삭제' }
        );
        await act(async () => {
            fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
        });
        expect(deleteConversationAction).toHaveBeenCalledWith('c9');
        expect(screen.queryByRole('link', { name: 'Other chat' })).toBeNull();
        expect(
            screen.getAllByRole('link', { name: 'Old title' }).length
        ).toBeGreaterThan(0);
        expect(router.push).not.toHaveBeenCalled();
        mockStream.conversationId = 'c1';
    });

    it('deleting the active conversation navigates home instead of splicing the rail entry', async () => {
        mockStream.conversationId = 'c1';
        wrap(
            <ChatShell
                conversationId="c1"
                initialMessages={[]}
                conversations={conversations}
                signedIn
                localePrefix=""
                siteUrl="https://siglens.io"
                currentPath="/c1"
            />
        );
        // "Old title" (c1) is the active conversation.
        fireEvent.click(
            within(rowFor('Old title')).getByRole('button', { name: '삭제' })
        );
        const confirmButtons = within(rowFor('Old title')).getAllByRole(
            'button',
            { name: '삭제' }
        );
        await act(async () => {
            fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
        });
        expect(deleteConversationAction).toHaveBeenCalledWith('c1');
        // Deleting the open conversation navigates away — the row is left
        // in place (`onDeleted` is not the path taken) since the app is
        // about to leave this screen entirely.
        expect(
            screen.getAllByRole('link', { name: 'Old title' }).length
        ).toBeGreaterThan(0);
        expect(router.push).toHaveBeenCalledWith('/');
        mockStream.conversationId = 'c1';
    });
});

/**
 * `?sso=none`은 서버가 핸드오프 재시도를 건너뛰는 신호일 뿐(`proxy.ts`가 쿠키로도
 * 기억한다) 방문자에게는 의미가 없다. 주소창에 남으면 새로고침·공유·북마크에 실려
 * 나간다. 마운트 때 `sso`만 지우고 `q`·광고 식별자·해시는 지켜야 한다.
 */
describe('ChatShell — ?sso=none 주소창 정리', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    afterEach(() => {
        window.history.replaceState(null, '', '/');
        vi.restoreAllMocks();
    });

    it('sso만 지우고 q·gclid·utm·해시는 보존한다', () => {
        window.history.replaceState(
            null,
            '',
            '/?q=NVDA%20%EC%96%B4%EB%95%8C&sso=none&gclid=G1&utm_source=google#composer'
        );
        const replaceState = vi.spyOn(window.history, 'replaceState');

        renderShell();

        expect(replaceState).toHaveBeenCalledTimes(1);
        expect(window.location.search).toBe(
            '?q=NVDA%20%EC%96%B4%EB%95%8C&gclid=G1&utm_source=google'
        );
        expect(window.location.hash).toBe('#composer');
        expect(window.location.pathname).toBe('/');
    });

    it('sso가 없으면 주소창을 건드리지 않는다', () => {
        window.history.replaceState(null, '', '/?q=hi');
        const replaceState = vi.spyOn(window.history, 'replaceState');

        renderShell();

        expect(replaceState).not.toHaveBeenCalled();
        expect(window.location.search).toBe('?q=hi');
    });
});
