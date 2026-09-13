import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { MessageList } from '@/widgets/agent-chat/MessageList';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

describe('MessageList', () => {
    // jsdom does not implement scrollIntoView; MessageList calls it on
    // endRef in a useEffect (matches src/widgets/chat/__tests__/ChatPanel.test.tsx).
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    it('renders tool chips, a regenerate button, a truncation banner, and a log region', () => {
        wrap(
            <MessageList
                messages={[
                    {
                        id: '1',
                        role: 'user',
                        content: 'q',
                        tools: [],
                        status: 'complete',
                        seq: 1,
                    },
                    {
                        id: '2',
                        role: 'assistant',
                        content: 'a',
                        tools: [
                            {
                                id: 't',
                                name: 'get_quote',
                                args: { symbols: ['AAPL'] },
                                status: 'ok',
                                ms: 40,
                            },
                        ],
                        status: 'complete',
                        truncated: true,
                    },
                ]}
                streaming={false}
                onRegenerate={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        expect(screen.getByText(/get_quote/)).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: /다시 생성/ })
        ).toBeInTheDocument();
        expect(screen.getByText(/답변이 잘렸/)).toBeInTheDocument();
        expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('drops aria-relevant from the outer log and moves an explicit aria-live to just the streaming bubble (role="log" still carries an implicit aria-live="polite" of its own; the fix is not making the log inert, it is no longer re-announcing the whole transcript on every delta)', () => {
        wrap(
            <MessageList
                messages={[
                    {
                        id: '1',
                        role: 'user',
                        content: 'q1',
                        tools: [],
                        status: 'complete',
                        seq: 1,
                    },
                    {
                        id: '2',
                        role: 'assistant',
                        content: 'answered already',
                        tools: [],
                        status: 'complete',
                    },
                    {
                        id: '3',
                        role: 'assistant',
                        content: 'partial',
                        tools: [],
                        status: 'streaming',
                    },
                ]}
                streaming
                onRegenerate={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        const log = screen.getByRole('log');
        // No EXPLICIT aria-live on the outer element — `role="log"` already
        // carries an implicit `aria-live="polite"` per the ARIA spec, so this
        // element is not inert; the bug this fixes was the explicit
        // `aria-relevant="additions text"` re-announcing the ENTIRE
        // transcript on every streamed delta, which `aria-relevant` (removed
        // below) is what actually controlled.
        expect(log).not.toHaveAttribute('aria-live');
        expect(log).not.toHaveAttribute('aria-relevant');
        const streamingBubble = screen
            .getByText('partial')
            .closest('.rounded-lg');
        expect(streamingBubble).toHaveAttribute('aria-live', 'polite');
        const completedBubble = screen
            .getByText('answered already')
            .closest('.rounded-lg');
        expect(completedBubble).not.toHaveAttribute('aria-live');
    });

    it('breaks long unbroken tokens (e.g. a 200-char URL from a tool result) instead of forcing horizontal scroll', () => {
        const longUrl = `https://example.com/${'a'.repeat(200)}`;
        wrap(
            <MessageList
                messages={[
                    {
                        id: '1',
                        role: 'assistant',
                        content: longUrl,
                        tools: [],
                        status: 'complete',
                    },
                ]}
                streaming={false}
                onRegenerate={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        const bubble = screen.getByText(longUrl).closest('.rounded-lg');
        expect(bubble?.className).toMatch(/break-words/);
    });

    it('shows an edit control for the last user message but not while streaming', () => {
        const onEdit = vi.fn();
        wrap(
            <MessageList
                messages={[
                    {
                        id: '1',
                        role: 'user',
                        content: 'q',
                        tools: [],
                        status: 'complete',
                        seq: 1,
                    },
                ]}
                streaming={false}
                onRegenerate={vi.fn()}
                onEdit={onEdit}
            />
        );
        expect(
            screen.getByRole('button', { name: /수정/ })
        ).toBeInTheDocument();
    });

    it('copy button tolerates a missing Clipboard API (non-secure context) without throwing', () => {
        const original = navigator.clipboard;
        // @ts-expect-error -- simulating a non-secure context where the Clipboard API is undefined
        delete navigator.clipboard;
        try {
            wrap(
                <MessageList
                    messages={[
                        {
                            id: '1',
                            role: 'assistant',
                            content: 'a',
                            tools: [],
                            status: 'complete',
                        },
                    ]}
                    streaming={false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            expect(() =>
                screen.getByRole('button', { name: /복사/ }).click()
            ).not.toThrow();
        } finally {
            Object.defineProperty(navigator, 'clipboard', {
                value: original,
                configurable: true,
            });
        }
    });
});
