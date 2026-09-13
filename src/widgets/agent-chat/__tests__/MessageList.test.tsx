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
                siteUrl="https://siglens.io"
                localePrefix=""
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
        // Tools are named in the reader's language, never by function name.
        expect(screen.getByText(/시세 확인/)).toBeInTheDocument();
        expect(screen.queryByText(/get_quote/)).toBeNull();
        // The symbol the answer read links back to its siglens.io page.
        expect(
            screen.getByRole('link', { name: /SIGLENS에서 AAPL 보기/ })
        ).toHaveAttribute('href', 'https://siglens.io/AAPL');
        expect(
            screen.getByRole('button', { name: /다시 생성/ })
        ).toBeInTheDocument();
        expect(screen.getByText(/답변이 잘렸/)).toBeInTheDocument();
        expect(screen.getByRole('log')).toBeInTheDocument();
    });

    it('drops aria-relevant from the outer log and moves an explicit aria-live to just the streaming bubble (role="log" still carries an implicit aria-live="polite" of its own; the fix is not making the log inert, it is no longer re-announcing the whole transcript on every delta)', () => {
        wrap(
            <MessageList
                siteUrl="https://siglens.io"
                localePrefix=""
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
            .closest('[aria-live]');
        expect(streamingBubble).toHaveAttribute('aria-live', 'polite');
        expect(
            screen.getByText('answered already').closest('[aria-live]')
        ).toBeNull();
    });

    it('breaks long unbroken tokens (e.g. a 200-char URL from a tool result) instead of forcing horizontal scroll', () => {
        const longUrl = `https://example.com/${'a'.repeat(200)}`;
        wrap(
            <MessageList
                siteUrl="https://siglens.io"
                localePrefix=""
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
        const body = screen
            .getByText(longUrl)
            .closest('article[data-role="assistant"]')
            ?.querySelector('.break-words');
        expect(body).not.toBeNull();
    });

    it('shows an edit control for the last user message but not while streaming', () => {
        const onEdit = vi.fn();
        wrap(
            <MessageList
                siteUrl="https://siglens.io"
                localePrefix=""
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
                    siteUrl="https://siglens.io"
                    localePrefix=""
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
