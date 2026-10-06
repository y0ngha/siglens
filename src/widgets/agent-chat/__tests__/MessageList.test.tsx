import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
import type { AgentUiMessage } from '@/features/agent-chat/model/types';
import ko from '../../../../messages/ko.json';

const { labels } = vi.hoisted(() => ({
    labels: vi.fn(async (symbols: readonly string[]) => ({
        labels: Object.fromEntries(
            symbols.filter(s => s === '005930.KS').map(s => [s, '삼성전자'])
        ),
        failed: [],
    })),
}));
vi.mock('@/entities/ticker/actions/getAssetLabelsAction', () => ({
    getAssetLabelsAction: labels,
}));
/** 링크 계산 횟수를 세려고 감싼다(동작은 원본 그대로). */
const { relatedCalls } = vi.hoisted(() => ({ relatedCalls: vi.fn() }));
vi.mock(
    '@/features/agent-chat/lib/relatedSymbolPages',
    async importOriginal => {
        const actual =
            await importOriginal<
                typeof import('@/features/agent-chat/lib/relatedSymbolPages')
            >();
        return {
            ...actual,
            relatedSymbolPages: (
                ...args: Parameters<typeof actual.relatedSymbolPages>
            ) => {
                relatedCalls(...args);
                return actual.relatedSymbolPages(...args);
            },
        };
    }
);

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
    // endRef in a useEffect.
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
                onSend={vi.fn()}
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
                onSend={vi.fn()}
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
                onSend={vi.fn()}
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
                onSend={vi.fn()}
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
                onSend={vi.fn()}
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
                onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                            onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                            onSend={vi.fn()}
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
                    onSend={vi.fn()}
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
                        onSend={vi.fn()}
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
                        onSend={vi.fn()}
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
                        onSend={vi.fn()}
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

            describe('"맨 아래로" 버튼을 스트리밍 중에 누르면 그 답변을 따라간다(opt-in)', () => {
                const BUTTON_NAME = /최신 메시지로 이동/;

                /**
                 * `scrollTop`을 쓰기 가능한 접근자로 바꿔 `container.scrollTop = …`
                 * 대입이 실제로 보이게 한다(jsdom 기본 setter는 값을 저장하지 않는다).
                 * `scrollHeight`는 `geometry.scrollHeight`를 읽으므로 테스트가 키운다.
                 * 브라우저처럼 `scrollTop`은 `scrollHeight - clientHeight`로 clamp된다
                 * (콘텐츠가 줄면 읽는 값도 따라 내려간다).
                 */
                const installLog = (
                    log: HTMLElement,
                    initial: { scrollTop: number; scrollHeight: number }
                ) => {
                    const geometry = {
                        scrollTop: initial.scrollTop,
                        scrollHeight: initial.scrollHeight,
                    };
                    Object.defineProperty(log, 'clientHeight', {
                        value: 400,
                        configurable: true,
                    });
                    Object.defineProperty(log, 'scrollHeight', {
                        get: () => geometry.scrollHeight,
                        configurable: true,
                    });
                    Object.defineProperty(log, 'scrollTop', {
                        get: () => {
                            // clamp를 저장해, 콘텐츠가 줄었다 다시 자라도 옛 값이 되살아나지 않는다.
                            geometry.scrollTop = Math.min(
                                geometry.scrollTop,
                                geometry.scrollHeight - 400
                            );
                            return geometry.scrollTop;
                        },
                        set: (v: number) => {
                            geometry.scrollTop = Math.min(
                                v,
                                geometry.scrollHeight - 400
                            );
                        },
                        configurable: true,
                    });
                    return geometry;
                };

                const renderStreaming = (streaming: boolean) =>
                    wrap(
                        <MessageList
                            siteUrl="https://siglens.io"
                            localePrefix=""
                            messages={[
                                userMsg('1', 'q1', 1),
                                assistantMsg(
                                    '2',
                                    'partial',
                                    streaming ? 'streaming' : 'complete'
                                ),
                            ]}
                            streaming={streaming}
                            onRegenerate={vi.fn()}
                            onEdit={vi.fn()}
                            onSend={vi.fn()}
                        />
                    );

                /** 위로 스크롤해 둔 로그 + 버튼을 띄운 상태까지 준비한다. */
                const setupScrolledUp = (streaming: boolean) => {
                    const view = renderStreaming(streaming);
                    const log = screen.getByRole('log');
                    const geometry = installLog(log, {
                        scrollTop: 100,
                        scrollHeight: 1000,
                    });
                    fireEvent.scroll(log);
                    return { ...view, log, geometry };
                };

                it('누르지 않으면 콘텐츠가 자라도 scrollTop을 건드리지 않는다', () => {
                    const { log, geometry } = setupScrolledUp(true);

                    geometry.scrollHeight = 1600;
                    act(() => resizeCallback?.());

                    expect(geometry.scrollTop).toBe(100);
                    expect(
                        screen.getByRole('button', { name: BUTTON_NAME })
                    ).toBeInTheDocument();
                    expect(log.scrollTo).toHaveBeenCalledTimes(0);
                });

                it('누른 뒤에는 콘텐츠가 자랄 때마다 맨 아래로 붙는다', () => {
                    const { log, geometry } = setupScrolledUp(true);

                    screen.getByRole('button', { name: BUTTON_NAME }).click();
                    // 스무스 스크롤 자체는 jsdom에서 일어나지 않으므로 도착을 흉내 낸다.
                    geometry.scrollTop = 600;
                    fireEvent.scroll(log);

                    geometry.scrollHeight = 1300;
                    act(() => resizeCallback?.());
                    expect(log.scrollTop).toBe(900);

                    geometry.scrollHeight = 1800;
                    act(() => resizeCallback?.());
                    expect(log.scrollTop).toBe(1400);
                });

                it('사용자가 위로 스크롤하면 따라가기를 멈춘다', () => {
                    const { log, geometry } = setupScrolledUp(true);

                    screen.getByRole('button', { name: BUTTON_NAME }).click();
                    geometry.scrollTop = 600;
                    fireEvent.scroll(log);
                    geometry.scrollHeight = 1300;
                    act(() => resizeCallback?.());
                    expect(log.scrollTop).toBe(900);

                    // 사용자가 위로 올린다(휠/터치/키보드 공통으로 scrollTop 감소).
                    geometry.scrollTop = 700;
                    fireEvent.scroll(log);

                    geometry.scrollHeight = 1900;
                    act(() => resizeCallback?.());
                    expect(log.scrollTop).toBe(700);
                });

                it('아래로 향하는 스크롤(스무스 스크롤 진행 등)은 따라가기를 멈추지 않는다', () => {
                    const { log, geometry } = setupScrolledUp(true);

                    screen.getByRole('button', { name: BUTTON_NAME }).click();
                    geometry.scrollTop = 300;
                    fireEvent.scroll(log);
                    geometry.scrollTop = 450;
                    fireEvent.scroll(log);

                    geometry.scrollHeight = 1400;
                    act(() => resizeCallback?.());
                    expect(log.scrollTop).toBe(1000);
                });

                it('스트림이 끝나면 따라가기를 멈춘다', () => {
                    const { log, geometry, rerender } = setupScrolledUp(true);

                    screen.getByRole('button', { name: BUTTON_NAME }).click();
                    geometry.scrollTop = 600;
                    fireEvent.scroll(log);
                    geometry.scrollHeight = 1300;
                    act(() => resizeCallback?.());
                    expect(log.scrollTop).toBe(900);

                    rerenderWith(rerender, {
                        messages: [
                            userMsg('1', 'q1', 1),
                            assistantMsg('2', 'done'),
                        ],
                        streaming: false,
                    });
                    // 사용자 스크롤 없이도(예: 칩이 붙어 콘텐츠가 자람) 더는 붙지 않는다.
                    geometry.scrollHeight = 1700;
                    act(() => resizeCallback?.());
                    expect(log.scrollTop).toBe(900);
                });

                /** 클릭 → 하단 도착 → 한 번 핀까지 마친, 따라가는 중 상태. */
                const setupFollowing = () => {
                    const ctx = setupScrolledUp(true);
                    screen.getByRole('button', { name: BUTTON_NAME }).click();
                    ctx.geometry.scrollTop = 600;
                    fireEvent.scroll(ctx.log);
                    ctx.geometry.scrollHeight = 1300;
                    act(() => resizeCallback?.());
                    expect(ctx.log.scrollTop).toBe(900);
                    return ctx;
                };

                it('느린 위로 스크롤(2px씩 여러 번)도 누적되어 따라가기를 끝낸다', () => {
                    const { log, geometry } = setupFollowing();

                    // 이벤트 하나는 허용 오차(4px) 아래지만 하단 밴드를 벗어난 뒤 누적되면 이탈이다.
                    for (let i = 1; i <= 6; i++) {
                        geometry.scrollTop = 900 - i * 2;
                        fireEvent.scroll(log);
                    }
                    geometry.scrollHeight = 1900;
                    act(() => resizeCallback?.());

                    expect(log.scrollTop).toBe(888);
                });

                it('위로 스크롤하는 동안 콘텐츠 갱신이 끼어들어도(스크롤 핸들러가 누적을 보기 전에) 다시 끌어내리지 않는다', () => {
                    const { log, geometry } = setupFollowing();

                    // 스크롤 이벤트가 아직 처리되지 않은 채(허용 오차 4px 밖으로 5px) 갱신이 온다.
                    geometry.scrollTop = 895;
                    geometry.scrollHeight = 1400;
                    act(() => resizeCallback?.());

                    expect(log.scrollTop).toBe(895);
                });

                it('하단 허용 오차 안에 머무는 급락(레이아웃 clamp/iOS 고무줄 복귀)은 이탈로 보지 않는다', () => {
                    const { log, geometry } = setupFollowing();

                    // 콘텐츠가 줄어 scrollTop이 최대값(=600)으로 clamp된다: 300px
                    // 떨어졌지만 거리 0이라 하단에 있다.
                    geometry.scrollHeight = 1000;
                    expect(log.scrollTop).toBe(600);
                    fireEvent.scroll(log);
                    geometry.scrollHeight = 1500;
                    act(() => resizeCallback?.());

                    expect(log.scrollTop).toBe(1100);
                });

                it('따라가는 중 새 사용자 메시지가 오면(앵커-온-센드) 따라가기를 끝낸다', () => {
                    const { log, geometry, rerender } = setupFollowing();

                    rerenderWith(rerender, {
                        messages: [
                            userMsg('1', 'q1', 1),
                            assistantMsg('2', 'done'),
                            userMsg('3', 'q2', 2),
                            assistantMsg('4', '', 'streaming'),
                        ],
                        streaming: true,
                    });
                    geometry.scrollHeight = 2000;
                    act(() => resizeCallback?.());

                    expect(log.scrollTop).toBe(900);
                });

                it('스트리밍이 아닐 때 누르면 따라가기가 시작되지 않는다', () => {
                    const { log, geometry } = setupScrolledUp(false);

                    screen.getByRole('button', { name: BUTTON_NAME }).click();
                    geometry.scrollTop = 600;
                    fireEvent.scroll(log);
                    geometry.scrollHeight = 1300;
                    act(() => resizeCallback?.());

                    expect(log.scrollTop).toBe(600);
                });

                it('누른 뒤 버튼이 사라져도 포커스가 body로 떨어지지 않고 로그에 남는다', () => {
                    const { log, geometry } = setupScrolledUp(true);

                    const button = screen.getByRole('button', {
                        name: BUTTON_NAME,
                    });
                    button.focus();
                    expect(document.activeElement).toBe(button);
                    button.click();
                    // 하단에 도착해 버튼이 언마운트된다.
                    geometry.scrollTop = 600;
                    fireEvent.scroll(log);

                    expect(
                        screen.queryByRole('button', { name: BUTTON_NAME })
                    ).toBeNull();
                    expect(document.activeElement).toBe(log);
                    expect(document.activeElement).not.toBe(document.body);
                });
            });
        });
    });

    /**
     * 에이전트는 답변 마지막 줄에 `[[followups]] A | B | C`를 덧붙인다. 그 줄은 **서버가**
     * 떼어 `followUps`로 넘기고(SSE `done`·`toMessageView`), 클라이언트는 받은 항목을 칩으로
     * 그리기만 한다 — 단 마지막으로 **끝난** 답변 밑에서만. 스트리밍 중에는 항목이 자라는
     * 중이라 칩을 그리면 깜빡이고, 지난 답변 밑의 칩은 이미 지나간 대화에 대한 질문을 보낸다.
     * (마커 줄 파싱·보류 규칙은 서버 테스트 `api/ai/chat/__tests__/followUps.test.ts`.)
     */
    describe('follow-up chips', () => {
        const BODY = '삼성전자는 약세입니다.';
        const FOLLOW_UPS = ['실적은 어때?', '뉴스도 알려줘'];

        const userMsg = (id: string, content: string, seq: number) =>
            ({
                id,
                role: 'user',
                content,
                tools: [],
                status: 'complete',
                seq,
            }) satisfies AgentUiMessage;
        const assistantMsg = (
            id: string,
            content: string,
            status: AgentUiMessage['status'] = 'complete',
            followUps?: readonly string[]
        ): AgentUiMessage => ({
            id,
            role: 'assistant',
            content,
            tools: [],
            status,
            ...(followUps ? { followUps } : {}),
        });

        const renderList = (
            messages: AgentUiMessage[],
            extra: { streaming?: boolean; onSend?: (text: string) => void } = {}
        ) =>
            wrap(
                <MessageList
                    siteUrl="https://siglens.io"
                    localePrefix=""
                    messages={messages}
                    streaming={extra.streaming ?? false}
                    onRegenerate={vi.fn()}
                    onEdit={vi.fn()}
                    onSend={extra.onSend ?? vi.fn()}
                />
            );

        it('서버가 넘긴 항목을 본문 밑에 칩으로 그린다 (min-h-11)', () => {
            renderList([
                userMsg('1', 'q', 1),
                assistantMsg('2', BODY, 'complete', FOLLOW_UPS),
            ]);

            expect(screen.getByText(BODY)).toBeInTheDocument();
            const group = screen.getByRole('list', { name: '이어서 물어보기' });
            const chips = within(group).getAllByRole('button');
            expect(chips.map(c => c.textContent)).toEqual(FOLLOW_UPS);
            for (const chip of chips) expect(chip).toHaveClass('min-h-11');
        });

        it('칩을 누르면 그 문구를 onSend로 보낸다', () => {
            const onSend = vi.fn();
            renderList(
                [
                    userMsg('1', 'q', 1),
                    assistantMsg('2', BODY, 'complete', FOLLOW_UPS),
                ],
                { onSend }
            );

            fireEvent.click(
                screen.getByRole('button', { name: '뉴스도 알려줘' })
            );

            expect(onSend).toHaveBeenCalledTimes(1);
            expect(onSend).toHaveBeenCalledWith('뉴스도 알려줘');
        });

        it('마지막 끝난 답변에만 칩을 그린다 — 지난 답변의 항목은 그리지 않는다', () => {
            renderList([
                userMsg('1', 'q1', 1),
                assistantMsg('2', '첫 답변입니다.', 'complete', ['지난 질문']),
                userMsg('3', 'q2', 2),
                assistantMsg('4', BODY, 'complete', FOLLOW_UPS),
            ]);

            expect(
                screen.queryByRole('button', { name: '지난 질문' })
            ).toBeNull();
            expect(screen.getByText('첫 답변입니다.')).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: '실적은 어때?' })
            ).toBeInTheDocument();
            expect(
                screen.getAllByRole('list', { name: '이어서 물어보기' })
            ).toHaveLength(1);
        });

        it('스트리밍 중인 답변에는 칩을 그리지 않는다', () => {
            renderList(
                [
                    userMsg('1', 'q', 1),
                    assistantMsg('2', BODY, 'streaming', FOLLOW_UPS),
                ],
                { streaming: true }
            );

            expect(screen.getByText(BODY)).toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: '실적은 어때?' })
            ).toBeNull();
            expect(screen.queryByText('이어서 물어보기')).toBeNull();
        });

        it('답변이 끝났어도 스트림이 아직 진행 중이면(streaming prop) 칩을 그리지 않는다', () => {
            renderList(
                [
                    userMsg('1', 'q', 1),
                    assistantMsg('2', BODY, 'complete', FOLLOW_UPS),
                ],
                { streaming: true }
            );

            expect(
                screen.queryByRole('button', { name: '실적은 어때?' })
            ).toBeNull();
        });

        it('중단되거나 실패한 답변에는 칩을 그리지 않는다', () => {
            renderList([
                userMsg('1', 'q', 1),
                assistantMsg('2', BODY, 'aborted', FOLLOW_UPS),
            ]);

            expect(
                screen.queryByRole('button', { name: '실적은 어때?' })
            ).toBeNull();
        });

        it('복사는 화면에 보이는 본문 그대로다', async () => {
            const writeText = vi.fn().mockResolvedValue(undefined);
            const original = navigator.clipboard;
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText },
                configurable: true,
            });
            try {
                renderList([
                    userMsg('1', 'q', 1),
                    assistantMsg('2', BODY, 'complete', FOLLOW_UPS),
                ]);
                const assistant = screen
                    .getByText(BODY)
                    .closest('article') as HTMLElement;

                await act(async () => {
                    fireEvent.click(
                        within(assistant).getByRole('button', { name: /복사/ })
                    );
                });

                expect(writeText).toHaveBeenCalledWith(BODY);
            } finally {
                Object.defineProperty(navigator, 'clipboard', {
                    value: original,
                    configurable: true,
                });
            }
        });

        it('사용자 메시지는 마커처럼 보여도 그대로 보여 주고 그대로 복사한다', async () => {
            const writeText = vi.fn().mockResolvedValue(undefined);
            const original = navigator.clipboard;
            Object.defineProperty(navigator, 'clipboard', {
                value: { writeText },
                configurable: true,
            });
            const typed = '이렇게 써 줘\n[[followups]] A | B';
            try {
                renderList([userMsg('1', typed, 1)]);
                const user = screen
                    .getByText(/이렇게 써 줘/)
                    .closest('article') as HTMLElement;

                await act(async () => {
                    fireEvent.click(
                        within(user).getByRole('button', { name: /복사/ })
                    );
                });

                expect(writeText).toHaveBeenCalledWith(typed);
            } finally {
                Object.defineProperty(navigator, 'clipboard', {
                    value: original,
                    configurable: true,
                });
            }
        });

        it('항목이 없거나 빈 배열이면 칩 영역이 없다', () => {
            renderList([
                userMsg('1', 'q', 1),
                assistantMsg('2', '평범한 답변입니다.'),
                userMsg('3', 'q2', 2),
                assistantMsg('4', '또 평범한 답변.', 'complete', []),
            ]);

            expect(screen.queryByText('이어서 물어보기')).toBeNull();
        });
    });

    /**
     * "siglens에서 보기" 표시 이름은 답변마다가 아니라 대화 전체에서 **한 번에** 묻는다 —
     * 서버 액션은 클라이언트에서 직렬화되므로 답변마다 물으면 긴 대화를 열 때 POST가 줄 선다.
     */
    describe('related page labels', () => {
        const answer = (id: string, symbol: string): AgentUiMessage => ({
            id,
            role: 'assistant',
            content: `${symbol} 답변`,
            tools: [
                {
                    id: `t-${id}`,
                    name: 'get_quote',
                    args: { symbol },
                    status: 'ok',
                },
            ],
            status: 'complete',
        });
        const listFor = (messages: AgentUiMessage[]) => (
            <MessageList
                siteUrl="https://siglens.io"
                localePrefix=""
                messages={messages}
                streaming={false}
                onRegenerate={vi.fn()}
                onEdit={vi.fn()}
                onSend={vi.fn()}
            />
        );
        /** rerender에도 같은 QueryClient를 쓰도록 클라이언트를 밖에서 받는다. */
        const providers = (client: QueryClient, ui: React.ReactElement) => (
            <QueryClientProvider client={client}>
                <NextIntlClientProvider locale="ko" messages={ko}>
                    {ui}
                </NextIntlClientProvider>
            </QueryClientProvider>
        );

        beforeEach(() => {
            labels.mockClear();
        });

        it('여러 답변의 심볼을 모아 한 번만 묻는다', async () => {
            wrap(
                listFor([
                    answer('a1', '005930.KS'),
                    answer('a2', 'AAPL'),
                    answer('a3', '005930.KS'),
                ])
            );

            expect(
                await screen.findAllByRole('link', {
                    name: /SIGLENS에서 삼성전자 보기/,
                })
            ).toHaveLength(2);
            expect(labels).toHaveBeenCalledTimes(1);
            expect(labels).toHaveBeenCalledWith(['005930.KS', 'AAPL']);
        });

        it('액션 상한(7개)을 넘으면 나눠 묻는다', async () => {
            const symbols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];
            wrap(listFor(symbols.map((s, i) => answer(`a${i}`, s))));

            await vi.waitFor(() => expect(labels).toHaveBeenCalledTimes(2));
            expect(labels.mock.calls.map(([batch]) => batch.length)).toEqual([
                7, 2,
            ]);
        });

        it('스트리밍 프레임마다 끝난 답변의 링크를 다시 계산하지 않는다', async () => {
            const client = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            });
            const done = answer('a1', '005930.KS');
            const streamingTurn = (content: string): AgentUiMessage => ({
                id: 'pending',
                role: 'assistant',
                content,
                tools: [],
                status: 'streaming',
            });
            const { rerender } = render(
                providers(client, listFor([done, streamingTurn('가')]))
            );
            await screen.findByRole('link', {
                name: /SIGLENS에서 삼성전자 보기/,
            });
            relatedCalls.mockClear();
            for (const text of ['가나', '가나다', '가나다라'])
                rerender(
                    providers(client, listFor([done, streamingTurn(text)]))
                );
            expect(relatedCalls).not.toHaveBeenCalled();
            expect(labels).toHaveBeenCalledTimes(1);
        });

        it('새 답변이 심볼을 더하면 아직 모르는 심볼만 더 묻는다', async () => {
            const client = new QueryClient({
                defaultOptions: { queries: { retry: false } },
            });
            const first = [answer('a1', '005930.KS')];
            const { rerender } = render(providers(client, listFor(first)));
            await screen.findByRole('link', {
                name: /SIGLENS에서 삼성전자 보기/,
            });

            rerender(
                providers(client, listFor([...first, answer('a2', 'AAPL')]))
            );

            await vi.waitFor(() => expect(labels).toHaveBeenCalledTimes(2));
            expect(labels.mock.calls[1]![0]).toEqual(['AAPL']);
            // 갱신 중에도 이미 받은 이름은 유지된다(심볼로 깜빡이지 않음).
            expect(
                screen.getByRole('link', { name: /SIGLENS에서 삼성전자 보기/ })
            ).toBeInTheDocument();
        });
    });
});
