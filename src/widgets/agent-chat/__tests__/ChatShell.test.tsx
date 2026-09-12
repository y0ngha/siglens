import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_ERROR_CODES } from '@/features/agent-chat';
import ko from '../../../../messages/ko.json';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));
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
    status: 'idle' as const,
    error: null as string | null,
    remaining: null,
    send: vi.fn(),
    regenerate: vi.fn(),
    edit: vi.fn(),
    retry: vi.fn(),
    stop: vi.fn(),
}));
vi.mock('@/features/agent-chat', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@/features/agent-chat')>();
    return { ...actual, useAgentStream: () => mockStream };
});

import { ChatShell } from '@/widgets/agent-chat/ChatShell';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

function renderShell() {
    return wrap(
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
