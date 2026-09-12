import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ko from '../../../../messages/ko.json';

const router = { refresh: vi.fn(), push: vi.fn() };
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

describe('Sidebar', () => {
    beforeEach(() => {
        router.refresh.mockClear();
        router.push.mockClear();
        deleteConversationAction.mockClear();
        renameConversationAction.mockClear();
    });

    it('focuses the rename input when entering rename mode, and returns focus to the ✎ button on Escape', () => {
        wrap(<Sidebar items={items} activeId={null} localePrefix="" />);
        const renameButton = screen.getByRole('button', { name: '이름 변경' });
        fireEvent.click(renameButton);
        const input = screen.getByRole('textbox', { name: '대화 이름' });
        expect(input).toHaveFocus();

        fireEvent.keyDown(input, { key: 'Escape' });
        expect(screen.queryByRole('textbox', { name: '대화 이름' })).toBeNull();
        expect(screen.getByRole('button', { name: '이름 변경' })).toHaveFocus();
    });

    it('does not cancel the rename when focus merely moves away (no onBlur cancel)', () => {
        wrap(<Sidebar items={items} activeId={null} localePrefix="" />);
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
        wrap(<Sidebar items={items} activeId={null} localePrefix="" />);
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        expect(deleteConversationAction).not.toHaveBeenCalled();
        expect(screen.getByText(/정말 삭제할까요/)).toBeInTheDocument();
    });

    it('deletes only after the confirmation click', async () => {
        wrap(<Sidebar items={items} activeId={null} localePrefix="" />);
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        const confirmButtons = screen.getAllByRole('button', { name: '삭제' });
        fireEvent.click(confirmButtons[confirmButtons.length - 1]!);
        await vi.waitFor(() =>
            expect(deleteConversationAction).toHaveBeenCalledWith('c1')
        );
    });

    it('cancelling the delete confirmation does not call the action', () => {
        wrap(<Sidebar items={items} activeId={null} localePrefix="" />);
        fireEvent.click(screen.getByRole('button', { name: '삭제' }));
        fireEvent.click(screen.getByRole('button', { name: '취소' }));
        expect(screen.queryByText(/정말 삭제할까요/)).toBeNull();
        expect(deleteConversationAction).not.toHaveBeenCalled();
    });
});
