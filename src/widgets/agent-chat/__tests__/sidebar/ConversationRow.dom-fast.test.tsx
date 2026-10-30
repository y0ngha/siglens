import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import ko from '../../../../../messages/ko.json';
import { ConversationRow } from '@/widgets/agent-chat/sidebar/ConversationRow';

const labels = ko.widgets['agent-chat'].Sidebar;

type RowState = Partial<{
    isActive: boolean;
    isPending: boolean;
    isRenaming: boolean;
    isConfirmingDelete: boolean;
}>;

function setup(state: RowState = {}) {
    const handlers = {
        onNavigate: vi.fn(),
        onToggleRename: vi.fn(),
        onAskDelete: vi.fn(),
        onConfirmDelete: vi.fn(),
        onCancelDelete: vi.fn(),
    };
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            <ul>
                <ConversationRow
                    item={{
                        id: 'c1',
                        title: '삼성전자 실적',
                        lastMessageAt: '2026-10-01T00:00:00.000Z',
                    }}
                    href="/c/c1"
                    isActive={state.isActive ?? false}
                    isPending={state.isPending ?? false}
                    isRenaming={state.isRenaming ?? false}
                    isConfirmingDelete={state.isConfirmingDelete ?? false}
                    renameForm={<form aria-label="rename-form" />}
                    {...handlers}
                />
            </ul>
        </NextIntlClientProvider>
    );
    return handlers;
}

describe('ConversationRow', () => {
    describe('기본 상태', () => {
        it('대화 링크와 이름 변경·삭제 버튼을 그린다', () => {
            const handlers = setup();
            const link = screen.getByRole('link', { name: '삼성전자 실적' });
            expect(link).toHaveAttribute('href', '/c/c1');
            fireEvent.click(link);
            expect(handlers.onNavigate).toHaveBeenCalledOnce();
            fireEvent.click(
                screen.getByRole('button', { name: labels['73e5a8'] })
            );
            expect(handlers.onToggleRename).toHaveBeenCalledWith(
                expect.any(HTMLButtonElement)
            );
            fireEvent.click(
                screen.getByRole('button', { name: labels.fc81e2 })
            );
            expect(handlers.onAskDelete).toHaveBeenCalledOnce();
        });

        it('활성 대화는 aria-current="page", 이동 중이면 aria-busy다', () => {
            setup({ isActive: true, isPending: true });
            const link = screen.getByRole('link', { name: '삼성전자 실적' });
            expect(link).toHaveAttribute('aria-current', 'page');
            expect(link).toHaveAttribute('aria-busy', 'true');
        });
    });

    describe('이름 바꾸기 중', () => {
        it('링크 자리에 폼이 들어가고, 같은 토글 버튼이 취소 이름을 갖는다', () => {
            setup({ isRenaming: true });
            expect(screen.queryByRole('link')).toBeNull();
            expect(
                screen.getByRole('form', { name: 'rename-form' })
            ).toBeInTheDocument();
            expect(
                screen.getByRole('button', { name: labels.renameCancel })
            ).toBeInTheDocument();
        });
    });

    describe('삭제 확인 중', () => {
        it('확인 문구와 삭제·취소 버튼만 보이고 행 동작 아이콘은 없다', () => {
            const handlers = setup({ isConfirmingDelete: true });
            expect(screen.getByText(labels['14bb5e'])).toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: labels['73e5a8'] })
            ).toBeNull();
            fireEvent.click(
                screen.getByRole('button', { name: labels.fc81e2 })
            );
            expect(handlers.onConfirmDelete).toHaveBeenCalledOnce();
            fireEvent.click(
                screen.getByRole('button', { name: labels['19b2d1'] })
            );
            expect(handlers.onCancelDelete).toHaveBeenCalledOnce();
        });
    });
});
