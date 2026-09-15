import { act, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ko from '../../../../messages/ko.json';

const router = { push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const { deleteConversationAction, renameConversationAction } = vi.hoisted(
    () => ({
        deleteConversationAction: vi.fn(async () => ({ ok: true })),
        renameConversationAction: vi.fn(async () => ({ ok: true })),
    })
);
vi.mock('@/entities/chat-conversation/actions', () => ({
    deleteConversationAction,
    renameConversationAction,
}));

import { Sidebar } from '@/widgets/agent-chat/Sidebar';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

const items = [{ id: 'c1', title: 'My chat', lastMessageAt: '2026-01-01' }];
const handlers = { onRenamed: vi.fn(), onDeleted: vi.fn() };

describe('Sidebar', () => {
    beforeEach(() => {
        router.push.mockClear();
        handlers.onRenamed.mockClear();
        handlers.onDeleted.mockClear();
        deleteConversationAction.mockClear();
        renameConversationAction.mockClear();
    });

    it('focuses the rename input when entering rename mode, and returns focus to the ✎ button on Escape', () => {
        wrap(
            <Sidebar
                {...handlers}
                signedIn
                loginHref="/login"
                siteUrl="https://siglens.io"
                items={items}
                activeId={null}
                localePrefix=""
            />
        );
        const renameButton = screen.getByRole('button', { name: '이름 변경' });
        fireEvent.click(renameButton);
        const input = screen.getByRole('textbox', { name: '대화 이름' });
        expect(input).toHaveFocus();

        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByRole('textbox', { name: '대화 이름' })).toBeNull();
        expect(screen.getByRole('button', { name: '이름 변경' })).toHaveFocus();
    });

    it('renders a status live region for the navigating state (empty while idle)', () => {
        wrap(
            <Sidebar
                {...handlers}
                signedIn
                loginHref="/login"
                siteUrl="https://siglens.io"
                items={items}
                activeId={null}
                localePrefix=""
            />
        );
        expect(screen.getByRole('status')).toHaveTextContent('');
    });

    it('does not cancel the rename when focus merely moves away (no onBlur cancel)', () => {
        wrap(
            <Sidebar
                {...handlers}
                signedIn
                loginHref="/login"
                siteUrl="https://siglens.io"
                items={items}
                activeId={null}
                localePrefix=""
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '이름 변경' }));
        const input = screen.getByRole('textbox', { name: '대화 이름' });
        fireEvent.change(input, { target: { value: 'Renamed' } });
        fireEvent.blur(input);
        // The rename input is still there — a stray blur must not discard it.
        expect(screen.getByRole('textbox', { name: '대화 이름' })).toHaveValue(
            'Renamed'
        );
    });

    it('requires a confirmation click before deleting (does not delete on the first click)', () => {
        wrap(
            <Sidebar
                {...handlers}
                signedIn
                loginHref="/login"
                siteUrl="https://siglens.io"
                items={items}
                activeId={null}
                localePrefix=""
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        expect(deleteConversationAction).not.toHaveBeenCalled();
        expect(screen.getByText(/정말 삭제할까요/)).toBeInTheDocument();
    });

    it('deletes only after the confirmation click', async () => {
        wrap(
            <Sidebar
                {...handlers}
                signedIn
                loginHref="/login"
                siteUrl="https://siglens.io"
                items={items}
                activeId={null}
                localePrefix=""
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        const confirmButtons = screen.getAllByRole('button', { name: '삭제' });
        fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
        await vi.waitFor(() =>
            expect(deleteConversationAction).toHaveBeenCalledWith('c1')
        );
        // Not the open conversation: drop it from the list in place — no refresh.
        await vi.waitFor(() =>
            expect(handlers.onDeleted).toHaveBeenCalledWith('c1')
        );
        expect(router.push).not.toHaveBeenCalled();
    });

    it('leaves the list alone when the server refuses the delete', async () => {
        deleteConversationAction.mockResolvedValueOnce({ ok: false });
        wrap(
            <Sidebar
                {...handlers}
                signedIn
                loginHref="/login"
                siteUrl="https://siglens.io"
                items={items}
                activeId={null}
                localePrefix=""
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        const confirmButtons = screen.getAllByRole('button', { name: '삭제' });
        await act(async () => {
            fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
        });
        expect(deleteConversationAction).toHaveBeenCalledWith('c1');
        expect(handlers.onDeleted).not.toHaveBeenCalled();
    });

    describe('rename', () => {
        const renderRail = () =>
            wrap(
                <Sidebar
                    {...handlers}
                    signedIn
                    loginHref="/login"
                    siteUrl="https://siglens.io"
                    items={items}
                    activeId={null}
                    localePrefix=""
                />
            );

        it('saves on Enter: applies the title at once, then persists it', async () => {
            renderRail();
            fireEvent.click(screen.getByRole('button', { name: '이름 변경' }));
            const input = screen.getByRole('textbox', { name: '대화 이름' });
            fireEvent.change(input, { target: { value: '  Renamed  ' } });
            await act(async () => {
                fireEvent.submit(input);
            });
            expect(handlers.onRenamed).toHaveBeenCalledWith('c1', 'Renamed');
            expect(renameConversationAction).toHaveBeenCalledWith(
                'c1',
                'Renamed'
            );
            expect(screen.queryByRole('textbox')).toBeNull();
        });

        it('rolls the title back when the server refuses the rename', async () => {
            renameConversationAction.mockResolvedValueOnce({ ok: false });
            renderRail();
            fireEvent.click(screen.getByRole('button', { name: '이름 변경' }));
            fireEvent.change(
                screen.getByRole('textbox', { name: '대화 이름' }),
                { target: { value: 'Renamed' } }
            );
            await act(async () => {
                fireEvent.submit(
                    screen.getByRole('textbox', { name: '대화 이름' })
                );
            });
            expect(handlers.onRenamed.mock.calls).toEqual([
                ['c1', 'Renamed'],
                ['c1', 'My chat'],
            ]);
        });

        it('does not call the server for an empty or unchanged title', async () => {
            renderRail();
            fireEvent.click(screen.getByRole('button', { name: '이름 변경' }));
            fireEvent.change(
                screen.getByRole('textbox', { name: '대화 이름' }),
                { target: { value: '   ' } }
            );
            await act(async () => {
                fireEvent.submit(
                    screen.getByRole('textbox', { name: '대화 이름' })
                );
            });
            expect(renameConversationAction).not.toHaveBeenCalled();
            expect(handlers.onRenamed).not.toHaveBeenCalled();
        });

        it('turns the ✎ button into a ✕ that cancels, and focus stays on it', () => {
            renderRail();
            fireEvent.click(screen.getByRole('button', { name: '이름 변경' }));
            const cancel = screen.getByRole('button', {
                name: '이름 변경 취소',
            });
            fireEvent.click(cancel);
            expect(screen.queryByRole('textbox')).toBeNull();
            expect(renameConversationAction).not.toHaveBeenCalled();
            expect(
                screen.getByRole('button', { name: '이름 변경' })
            ).toHaveFocus();
        });

        it('cancels when the user presses outside the row, but not inside it', () => {
            renderRail();
            fireEvent.click(screen.getByRole('button', { name: '이름 변경' }));
            const input = screen.getByRole('textbox', { name: '대화 이름' });
            fireEvent.pointerDown(input);
            expect(
                screen.getByRole('textbox', { name: '대화 이름' })
            ).toBeInTheDocument();

            fireEvent.pointerDown(document.body);
            expect(screen.queryByRole('textbox')).toBeNull();
            expect(renameConversationAction).not.toHaveBeenCalled();
        });
    });

    it('cancelling the delete confirmation does not call the action', () => {
        wrap(
            <Sidebar
                {...handlers}
                signedIn
                loginHref="/login"
                siteUrl="https://siglens.io"
                items={items}
                activeId={null}
                localePrefix=""
            />
        );
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        fireEvent.click(screen.getByRole('button', { name: '취소' }));
        expect(screen.queryByText(/정말 삭제할까요/)).toBeNull();
        expect(deleteConversationAction).not.toHaveBeenCalled();
    });

    /**
     * Switching conversations is a client transition, not a document reload: the
     * reload streamed a loading skeleton before every conversation (2026-09-15).
     * Modified clicks keep the browser's own behaviour (new tab / window).
     */
    describe('in-app navigation', () => {
        const renderRail = () =>
            wrap(
                <Sidebar
                    {...handlers}
                    onNavigate={onNavigate}
                    signedIn
                    loginHref="/login"
                    siteUrl="https://siglens.io"
                    items={items}
                    activeId={null}
                    localePrefix="/en"
                />
            );
        const onNavigate = vi.fn();

        beforeEach(() => {
            onNavigate.mockClear();
        });

        it('opens a conversation with router.push instead of reloading the page', () => {
            renderRail();
            const link = screen.getByRole('link', { name: 'My chat' });
            const notPrevented = fireEvent.click(link);
            expect(notPrevented).toBe(false);
            expect(router.push).toHaveBeenCalledWith('/en/c/c1');
            expect(onNavigate).toHaveBeenCalledTimes(1);
        });

        /**
         * Clicking the conversation already on screen pushes the same URL: Next does
         * not remount ChatShell, so nothing else would close the mobile drawer —
         * the settle-time `onNavigate` must still fire.
         */
        it('still calls onNavigate for the conversation already open (same URL, no remount)', () => {
            wrap(
                <Sidebar
                    {...handlers}
                    onNavigate={onNavigate}
                    signedIn
                    loginHref="/login"
                    siteUrl="https://siglens.io"
                    items={items}
                    activeId="c1"
                    localePrefix="/en"
                />
            );
            const active = screen.getByRole('link', { name: 'My chat' });
            expect(active).toHaveAttribute('aria-current', 'page');
            fireEvent.click(active);
            expect(router.push).toHaveBeenCalledWith('/en/c/c1');
            expect(onNavigate).toHaveBeenCalledTimes(1);
        });

        it('calls onNavigate only once the transition settles, keeping the status announcement up while pending', async () => {
            // A promise-returning push turns the transition into an async action,
            // so `isNavigating` stays true until it resolves — the window in which
            // the mobile drawer used to close and unmount the live region.
            let finish!: () => void;
            router.push.mockReturnValueOnce(
                new Promise<void>(resolve => {
                    finish = resolve;
                })
            );
            renderRail();
            fireEvent.click(screen.getByRole('link', { name: 'My chat' }));
            expect(screen.getByRole('status')).toHaveTextContent(
                '불러오는 중…'
            );
            expect(onNavigate).not.toHaveBeenCalled();

            await act(async () => finish());
            expect(screen.getByRole('status')).toHaveTextContent('');
            expect(onNavigate).toHaveBeenCalledTimes(1);
        });

        it('starts a new chat the same way', () => {
            renderRail();
            fireEvent.click(screen.getByRole('link', { name: '새 대화' }));
            expect(router.push).toHaveBeenCalledWith('/en/');
        });

        it('leaves ⌘/Ctrl/middle clicks to the browser', () => {
            renderRail();
            const link = screen.getByRole('link', { name: 'My chat' });
            expect(fireEvent.click(link, { metaKey: true })).toBe(true);
            expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
            expect(fireEvent.click(link, { button: 1 })).toBe(true);
            expect(router.push).not.toHaveBeenCalled();
            expect(onNavigate).not.toHaveBeenCalled();
        });
    });

    describe('grouping and navigation', () => {
        const day = (d: number, h = 9) =>
            new Date(2026, 8, 12 - d, h).toISOString();
        const many = [
            { id: 'today', title: 'Today chat', lastMessageAt: day(0) },
            { id: 'yday', title: 'Yesterday chat', lastMessageAt: day(1) },
            { id: 'old', title: 'Old chat', lastMessageAt: day(40) },
        ];

        it('groups conversations under day headings and marks the active one', () => {
            vi.useFakeTimers({
                now: new Date(2026, 8, 12, 12),
                toFake: ['Date'],
            });
            try {
                wrap(
                    <Sidebar
                        {...handlers}
                        signedIn
                        loginHref="/login"
                        siteUrl="https://siglens.io"
                        items={many}
                        activeId="yday"
                        localePrefix="/en"
                    />
                );
                expect(screen.getByText('오늘')).toBeInTheDocument();
                expect(screen.getByText('어제')).toBeInTheDocument();
                expect(screen.getByText('이전')).toBeInTheDocument();
                expect(screen.queryByText('지난 7일')).toBeNull();
                const active = screen.getByRole('link', {
                    name: 'Yesterday chat',
                });
                expect(active).toHaveAttribute('aria-current', 'page');
                expect(active).toHaveAttribute('href', '/en/c/yday');
                expect(
                    screen.getByRole('link', { name: 'Today chat' })
                ).not.toHaveAttribute('aria-current');
                expect(
                    screen.getByRole('link', { name: '새 대화' })
                ).toHaveAttribute('href', '/en/');
            } finally {
                vi.useRealTimers();
            }
        });

        it('shows an empty message with no conversations and a no-match message when the filter hits nothing', () => {
            const { unmount } = wrap(
                <Sidebar
                    {...handlers}
                    signedIn
                    loginHref="/login"
                    siteUrl="https://siglens.io"
                    items={[]}
                    activeId={null}
                    localePrefix=""
                />
            );
            expect(
                screen.getByText('아직 대화가 없습니다.')
            ).toBeInTheDocument();
            unmount();
            wrap(
                <Sidebar
                    {...handlers}
                    signedIn
                    loginHref="/login"
                    siteUrl="https://siglens.io"
                    items={items}
                    activeId={null}
                    localePrefix=""
                />
            );
            fireEvent.change(
                screen.getByRole('searchbox', { name: '대화 검색' }),
                {
                    target: { value: 'zzz' },
                }
            );
            expect(
                screen.getByText('검색 결과가 없습니다.')
            ).toBeInTheDocument();
            expect(screen.queryByRole('link', { name: 'My chat' })).toBeNull();
        });
    });

    it('guest: no list or search — a sign-in panel, plus legal links back to siglens.io', () => {
        wrap(
            <Sidebar
                {...handlers}
                signedIn={false}
                loginHref="https://siglens.io/login?next=x"
                siteUrl="https://siglens.io"
                items={[]}
                activeId={null}
                localePrefix="/en"
            />
        );
        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(
            screen.getByRole('link', { name: '로그인하기' })
        ).toHaveAttribute('href', 'https://siglens.io/login?next=x');
        expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute(
            'href',
            'https://siglens.io/en/terms'
        );
        expect(
            screen.getByRole('link', { name: '개인정보처리방침' })
        ).toHaveAttribute('href', 'https://siglens.io/en/privacy');
    });
});
