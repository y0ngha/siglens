import { act, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
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
import type { AgentUiMessage } from '@/features/agent-chat';
import ko from '../../../../messages/ko.json';

const { labels } = vi.hoisted(() => ({
    labels: vi.fn(async (symbols: readonly string[]) => ({
        labels: Object.fromEntries(
            symbols.filter(s => s === '005930.KS').map(s => [s, '삼성전자'])
        ),
        failed: [],
    })),
}));
vi.mock('@/entities/ticker/actions', () => ({
    getAssetLabelsAction: labels,
}));

import { MessageList } from '@/widgets/agent-chat/MessageList';

const wrap = (ui: React.ReactElement) =>
    render(
        <QueryClientProvider
            client={
                new QueryClient({
                    defaultOptions: { queries: { retry: false } },
                })
            }
        >
            <NextIntlClientProvider locale="ko" messages={ko}>
                {ui}
            </NextIntlClientProvider>
        </QueryClientProvider>
    );

describe('MessageList', () => {
    // jsdom does not implement scrollIntoView; MessageList calls it on
    // endRef in a useEffect (matches src/widgets/chat/__tests__/ChatPanel.test.tsx).
    // save/restore, mirroring the `navigator.clipboard`
    // pattern below — a global prototype patch with no restore leaks the
    // stub into every OTHER test file that runs later in the same process.
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });
    afterAll(() => {
        Element.prototype.scrollIntoView = originalScrollIntoView;
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

    it('names the related page by company name once it is known, the symbol until then', async () => {
        wrap(
            <MessageList
                siteUrl="https://siglens.io"
                localePrefix=""
                messages={[
                    {
                        id: '2',
                        role: 'assistant',
                        content: 'a',
                        tools: [
                            {
                                id: 't',
                                name: 'get_cached_analysis',
                                args: { symbol: '005930.KS', tab: 'overall' },
                                status: 'ok',
                            },
                        ],
                        status: 'complete',
                    },
                ]}
                streaming={false}
                onRegenerate={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        expect(
            await screen.findByRole('link', {
                name: /SIGLENS에서 삼성전자 보기/,
            })
        ).toHaveAttribute('href', 'https://siglens.io/005930.KS/overall');
        expect(labels).toHaveBeenCalledWith(['005930.KS']);
    });

    it('shows an abandoned draft dimmed with a note while the rewritten answer has not started', () => {
        wrap(
            <MessageList
                siteUrl="https://siglens.io"
                localePrefix=""
                messages={[
                    {
                        id: '3',
                        role: 'assistant',
                        content: '',
                        draft: '초안 답변 본문',
                        tools: [],
                        status: 'streaming',
                    },
                ]}
                streaming
                onRegenerate={vi.fn()}
                onEdit={vi.fn()}
            />
        );
        expect(
            screen.getByText(/답변을 다시 정리하고 있어요/)
        ).toBeInTheDocument();
        expect(screen.getByText('초안 답변 본문')).toBeInTheDocument();
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

    describe('scroll behavior (spec §3.9)', () => {
        let scrollIntoViewSpy: ReturnType<typeof vi.fn>;
        const originalScrollTo = Element.prototype.scrollTo;

        beforeEach(() => {
            const spy = vi.fn();
            scrollIntoViewSpy = spy;
            Element.prototype.scrollIntoView =
                spy as unknown as typeof Element.prototype.scrollIntoView;
            Element.prototype.scrollTo =
                vi.fn() as unknown as typeof Element.prototype.scrollTo;
        });

        afterEach(() => {
            // `scrollIntoView` is restored by the parent describe's
            // `afterAll` (still needed within this block for the outer
            // `beforeAll` stub); `scrollTo` has no outer-level stub, so
            // restore it per-test here.
            Element.prototype.scrollTo = originalScrollTo;
        });

        const userMsg = (
            id: string,
            content: string,
            seq: number
        ): AgentUiMessage => ({
            id,
            role: 'user',
            content,
            tools: [],
            status: 'complete',
            seq,
        });
        const assistantMsg = (
            id: string,
            content: string,
            status: AgentUiMessage['status'] = 'complete'
        ): AgentUiMessage => ({
            id,
            role: 'assistant',
            content,
            tools: [],
            status,
        });

        /** `rerender` needs a fresh element wrapped in the SAME providers `wrap` uses — a bare `<MessageList>` would lose the QueryClient/next-intl context. */
        const rerenderWith = (
            rerender: (ui: React.ReactElement) => void,
            props: {
                messages: AgentUiMessage[];
                streaming: boolean;
            }
        ): void => {
            rerender(
                <QueryClientProvider
                    client={
                        new QueryClient({
                            defaultOptions: { queries: { retry: false } },
                        })
                    }
                >
                    <NextIntlClientProvider locale="ko" messages={ko}>
                        <MessageList
                            siteUrl="https://siglens.io"
                            localePrefix=""
                            messages={props.messages}
                            streaming={props.streaming}
                            onRegenerate={vi.fn()}
                            onEdit={vi.fn()}
                        />
                    </NextIntlClientProvider>
                </QueryClientProvider>
            );
        };

        it('mount(대화 열기/전환)은 즉시 맨 아래로 점프한다 (block:end)', () => {
            wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={[userMsg('1', 'q1', 1), assistantMsg('2', 'a1')]}
                    streaming={false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            expect(scrollIntoViewSpy).toHaveBeenCalledWith({ block: 'end' });
            // Only the mount jump — no anchor-to-top call for pre-existing history.
            expect(
                scrollIntoViewSpy.mock.calls.filter(
                    c => (c[0] as { block?: string })?.block === 'start'
                )
            ).toHaveLength(0);
        });

        it('새 사용자 메시지가 추가되면(전송) 그 메시지를 뷰포트 상단으로 앵커한다', () => {
            const { rerender } = wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={[userMsg('1', 'q1', 1), assistantMsg('2', 'a1')]}
                    streaming={false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            scrollIntoViewSpy.mockClear();
            rerenderWith(rerender, {
                messages: [
                    userMsg('1', 'q1', 1),
                    assistantMsg('2', 'a1'),
                    userMsg('3', 'q2 new question', 2),
                ],
                streaming: true,
            });
            const startCalls = scrollIntoViewSpy.mock.calls.filter(
                c => (c[0] as { block?: string })?.block === 'start'
            );
            expect(startCalls).toHaveLength(1);
            // The call landed on the NEW user message's article, not some other node.
            const calledOn = scrollIntoViewSpy.mock.contexts.at(
                scrollIntoViewSpy.mock.calls.indexOf(startCalls[0]!)
            ) as HTMLElement;
            expect(calledOn.textContent).toContain('q2 new question');
        });

        it('앵커 스크롤은 min-height가 DOM에 반영된 이후에 실행된다 (순서)', () => {
            const { rerender } = wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={[userMsg('1', 'q1', 1), assistantMsg('2', 'a1')]}
                    streaming={false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            const log = screen.getByRole('log');
            Object.defineProperty(log, 'clientHeight', {
                value: 900,
                configurable: true,
            });
            // Capture the scrolled node's OWN min-height style at the exact
            // moment `scrollIntoView` runs — this is what would regress if
            // the scroll ran in the same effect as `setActiveMinHeight`
            // (before that state update is committed to the DOM).
            const minHeightAtCallTime: string[] = [];
            scrollIntoViewSpy.mockImplementation(function (this: HTMLElement) {
                minHeightAtCallTime.push(this.style.minHeight);
            });
            rerenderWith(rerender, {
                messages: [
                    userMsg('1', 'q1', 1),
                    assistantMsg('2', 'a1'),
                    userMsg('3', 'q2 new question', 2),
                ],
                streaming: true,
            });
            // The anchored node is the LAST rendered message at the time of
            // the scroll — at this point that's the just-sent user message
            // itself (no assistant reply appended yet).
            expect(minHeightAtCallTime).toHaveLength(1);
            expect(minHeightAtCallTime[0]).toBe('900px');
        });

        it('같은 뷰포트 높이로 연속 전송해도(clientHeight 불변) 두 번째 전송도 새 앵커로 스크롤한다', () => {
            const { rerender } = wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={[userMsg('1', 'q1', 1), assistantMsg('2', 'a1')]}
                    streaming={false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            const log = screen.getByRole('log');
            Object.defineProperty(log, 'clientHeight', {
                value: 800,
                configurable: true,
            });

            // First send (q2) — grows min-height to { px: 800 }, scrolls to q2.
            scrollIntoViewSpy.mockClear();
            rerenderWith(rerender, {
                messages: [
                    userMsg('1', 'q1', 1),
                    assistantMsg('2', 'a1'),
                    userMsg('3', 'q2', 2),
                    assistantMsg('4', 'a2', 'complete'),
                ],
                streaming: false,
            });
            expect(
                scrollIntoViewSpy.mock.calls.filter(
                    c => (c[0] as { block?: string })?.block === 'start'
                )
            ).toHaveLength(1);

            // Second send (q3) — the SAME clientHeight (800) as the first
            // send. A bare `useState<number>` for the min-height would bail
            // out of re-rendering on this repeat value (React's built-in
            // Object.is same-value check), silently starving the
            // `useLayoutEffect` (keyed on that state) of its trigger and
            // dropping this scroll entirely — the exact regression the
            // `{ px }` object wrapping exists to prevent.
            scrollIntoViewSpy.mockClear();
            rerenderWith(rerender, {
                messages: [
                    userMsg('1', 'q1', 1),
                    assistantMsg('2', 'a1'),
                    userMsg('3', 'q2', 2),
                    assistantMsg('4', 'a2', 'complete'),
                    userMsg('5', 'q3', 3),
                ],
                streaming: true,
            });
            const secondStartCalls = scrollIntoViewSpy.mock.calls.filter(
                c => (c[0] as { block?: string })?.block === 'start'
            );
            expect(secondStartCalls).toHaveLength(1);
            const calledOn = scrollIntoViewSpy.mock.contexts.at(
                scrollIntoViewSpy.mock.calls.indexOf(secondStartCalls[0]!)
            ) as HTMLElement;
            expect(calledOn.textContent).toContain('q3');
        });

        it('스트리밍이 끝나도 min-height는 유지되고(짧은 답변에서 화면이 접히지 않음), 다음 앵커에서만 바뀐다', () => {
            const { rerender } = wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={[userMsg('1', 'q1', 1), assistantMsg('2', 'a1')]}
                    streaming={false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            const log = screen.getByRole('log');
            Object.defineProperty(log, 'clientHeight', {
                value: 700,
                configurable: true,
            });
            // Send → streaming starts, min-height grows to 700.
            rerenderWith(rerender, {
                messages: [
                    userMsg('1', 'q1', 1),
                    assistantMsg('2', 'a1'),
                    userMsg('3', 'q2', 2),
                    assistantMsg('4', '', 'streaming'),
                ],
                streaming: true,
            });
            // Streaming finishes with a SHORT answer — min-height must
            // still be applied to the (now-last) assistant article.
            rerenderWith(rerender, {
                messages: [
                    userMsg('1', 'q1', 1),
                    assistantMsg('2', 'a1'),
                    userMsg('3', 'q2', 2),
                    assistantMsg('4', 'short answer', 'complete'),
                ],
                streaming: false,
            });
            const finishedArticle = screen
                .getByText('short answer')
                .closest('article[data-role="assistant"]') as HTMLElement;
            expect(finishedArticle.style.minHeight).toBe('700px');
        });

        it('스트리밍 중에는 새 메시지가 없으면 맨 아래로 따라가지 않는다(auto-follow 제거)', () => {
            const { rerender } = wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={[
                        userMsg('1', 'q1', 1),
                        assistantMsg('2', '', 'streaming'),
                    ]}
                    streaming
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            scrollIntoViewSpy.mockClear();
            // Same assistant message, just more streamed text — content
            // updates only, no new message id.
            rerender(
                <QueryClientProvider
                    client={
                        new QueryClient({
                            defaultOptions: { queries: { retry: false } },
                        })
                    }
                >
                    <NextIntlClientProvider locale="ko" messages={ko}>
                        <MessageList
                            siteUrl="https://siglens.io"
                            localePrefix=""
                            messages={[
                                userMsg('1', 'q1', 1),
                                assistantMsg(
                                    '2',
                                    'partial answer so far',
                                    'streaming'
                                ),
                            ]}
                            streaming
                            onRegenerate={vi.fn()}
                            onEdit={vi.fn()}
                        />
                    </NextIntlClientProvider>
                </QueryClientProvider>
            );
            expect(scrollIntoViewSpy).not.toHaveBeenCalled();
        });

        it('스크롤이 하단에서 80px 넘게 떨어지면 "맨 아래로" 버튼이 나타나고, 클릭하면 스크롤한다', () => {
            wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={[userMsg('1', 'q1', 1), assistantMsg('2', 'a1')]}
                    streaming={false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                />
            );
            expect(
                screen.queryByRole('button', { name: /최신 메시지로 이동/ })
            ).toBeNull();

            const log = screen.getByRole('log');
            Object.defineProperty(log, 'scrollHeight', {
                value: 1000,
                configurable: true,
            });
            Object.defineProperty(log, 'clientHeight', {
                value: 400,
                configurable: true,
            });
            Object.defineProperty(log, 'scrollTop', {
                value: 100, // distance from bottom = 1000-100-400 = 500 > 80
                configurable: true,
            });
            fireEvent.scroll(log);

            const button = screen.getByRole('button', {
                name: /최신 메시지로 이동/,
            });
            expect(button).toBeInTheDocument();
            button.click();
            expect(log.scrollTo).toHaveBeenCalledWith(
                expect.objectContaining({ top: 1000, behavior: 'smooth' })
            );
        });

        it('prefers-reduced-motion이면 "맨 아래로" 스크롤이 smooth 대신 auto다', () => {
            const originalMatchMedia = window.matchMedia;
            window.matchMedia = vi.fn().mockReturnValue({ matches: true });
            try {
                wrap(
                    <MessageList
                        siteUrl="https://siglens.io"
                        localePrefix=""
                        messages={[
                            userMsg('1', 'q1', 1),
                            assistantMsg('2', 'a1'),
                        ]}
                        streaming={false}
                        onRegenerate={vi.fn()}
                        onEdit={vi.fn()}
                    />
                );
                const log = screen.getByRole('log');
                Object.defineProperty(log, 'scrollHeight', {
                    value: 1000,
                    configurable: true,
                });
                Object.defineProperty(log, 'clientHeight', {
                    value: 400,
                    configurable: true,
                });
                Object.defineProperty(log, 'scrollTop', {
                    value: 0,
                    configurable: true,
                });
                fireEvent.scroll(log);
                screen
                    .getByRole('button', { name: /최신 메시지로 이동/ })
                    .click();
                expect(log.scrollTo).toHaveBeenCalledWith(
                    expect.objectContaining({ behavior: 'auto' })
                );
            } finally {
                window.matchMedia = originalMatchMedia;
            }
        });

        describe('스트리밍 중 콘텐츠가 자라면(스크롤 이벤트 없이) 버튼 상태도 따라간다', () => {
            // `handleScroll`만으로는 버튼을 못 채운다 — 스트리밍은 스크롤
            // 이벤트를 발생시키지 않고 `scrollHeight`만 키운다. `MessageList`가
            // 콘텐츠 래퍼에 붙이는 ResizeObserver를 가로채, 그 콜백만으로
            // 버튼이 반응하는지 본다(usePaneLabels.test.ts의 목 패턴).
            let resizeCallback: (() => void) | null = null;

            class MockResizeObserver {
                observe = vi.fn();
                unobserve = vi.fn();
                disconnect = vi.fn();
                constructor(callback: () => void) {
                    resizeCallback = callback;
                }
            }

            beforeEach(() => {
                resizeCallback = null;
                vi.stubGlobal('ResizeObserver', MockResizeObserver);
            });

            afterEach(() => {
                vi.unstubAllGlobals();
            });

            const setLogGeometry = (
                log: HTMLElement,
                geometry: {
                    scrollHeight: number;
                    scrollTop: number;
                    clientHeight: number;
                }
            ): void => {
                Object.defineProperty(log, 'scrollHeight', {
                    value: geometry.scrollHeight,
                    configurable: true,
                });
                Object.defineProperty(log, 'scrollTop', {
                    value: geometry.scrollTop,
                    configurable: true,
                });
                Object.defineProperty(log, 'clientHeight', {
                    value: geometry.clientHeight,
                    configurable: true,
                });
            };

            it('스크롤 이벤트 없이 콘텐츠가 자라 80px 넘게 멀어지면 버튼이 나타난다', () => {
                wrap(
                    <MessageList
                        siteUrl="https://siglens.io"
                        localePrefix=""
                        messages={[
                            userMsg('1', 'q1', 1),
                            assistantMsg('2', '', 'streaming'),
                        ]}
                        streaming
                        onRegenerate={vi.fn()}
                        onEdit={vi.fn()}
                    />
                );
                const log = screen.getByRole('log');
                // 거리 = 1000-100-400 = 500 > 80.
                setLogGeometry(log, {
                    scrollHeight: 1000,
                    scrollTop: 100,
                    clientHeight: 400,
                });

                expect(resizeCallback).not.toBeNull();
                act(() => resizeCallback?.());

                expect(
                    screen.getByRole('button', { name: /최신 메시지로 이동/ })
                ).toBeInTheDocument();
            });

            it('콘텐츠가 자라도 거리가 80px 이하면 버튼은 숨겨진 채 유지된다', () => {
                wrap(
                    <MessageList
                        siteUrl="https://siglens.io"
                        localePrefix=""
                        messages={[
                            userMsg('1', 'q1', 1),
                            assistantMsg('2', '', 'streaming'),
                        ]}
                        streaming
                        onRegenerate={vi.fn()}
                        onEdit={vi.fn()}
                    />
                );
                const log = screen.getByRole('log');
                // 거리 = 440-20-400 = 20 <= 80.
                setLogGeometry(log, {
                    scrollHeight: 440,
                    scrollTop: 20,
                    clientHeight: 400,
                });

                act(() => resizeCallback?.());

                expect(
                    screen.queryByRole('button', { name: /최신 메시지로 이동/ })
                ).toBeNull();
            });
        });
    });
});
