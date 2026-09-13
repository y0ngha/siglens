import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_ERROR_CODES } from '@/features/agent-chat';
import ko from '../../../../messages/ko.json';

const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/features/auth-logout/actions/logoutAction', () => ({
    logoutAction: vi.fn(),
}));

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

    it('the banner retry button calls stream.retry(), never stream.regenerate() directly', () => {
        mockStream.error = 'server_busy';
        renderShell();
        fireEvent.click(screen.getByRole('button', { name: /재시도/ }));
        expect(mockStream.retry).toHaveBeenCalledTimes(1);
        expect(mockStream.regenerate).not.toHaveBeenCalled();
    });
});

describe('ChatShell new-conversation refresh', () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    beforeEach(() => {
        router.refresh.mockClear();
        captured.options = null;
        mockStream.error = null;
    });

    /**
     * `/c/[id]` is a different route segment than the page that rendered this shell,
     * so a refresh mid-turn remounts ChatShell: the stream hook's unmount cleanup
     * aborts the live request and the answer never arrives. Asserting only the final
     * refresh would pass even if it fired immediately — the point is that it does NOT
     * fire while `status === 'streaming'`.
     */
    it('holds router.refresh() until the turn stops streaming', () => {
        mockStream.status = 'streaming';
        const { rerender } = renderShell();
        act(() => {
            captured.options?.onConversationCreated?.('c2', 't');
        });
        expect(window.location.pathname).toBe('/c/c2');
        expect(router.refresh).not.toHaveBeenCalled();

        mockStream.status = 'idle';
        rerender(
            <NextIntlClientProvider locale="ko" messages={ko}>
                {shellTree()}
            </NextIntlClientProvider>
        );
        expect(router.refresh).toHaveBeenCalledTimes(1);
    });

    it('does not refresh when no conversation was created', () => {
        mockStream.status = 'streaming';
        const { rerender } = renderShell();
        mockStream.status = 'idle';
        rerender(
            <NextIntlClientProvider locale="ko" messages={ko}>
                {shellTree()}
            </NextIntlClientProvider>
        );
        expect(router.refresh).not.toHaveBeenCalled();
    });
});
