import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/widgets/agent-chat/EmptyState';
import ko from '../../../../messages/ko.json';

const wrap = (ui: React.ReactElement) =>
    render(
        <NextIntlClientProvider locale="ko" messages={ko}>
            {ui}
        </NextIntlClientProvider>
    );

describe('EmptyState', () => {
    it('prefers AI suggestions and sends the clicked one', () => {
        const onPick = vi.fn();
        wrap(
            <EmptyState
                onPick={onPick}
                signedIn
                loginHref="/login"
                suggestions={['오늘 시장 어때?', 'NVDA 뉴스 요약']}
            />
        );
        const list = screen.getByRole('list', {
            name: '이렇게 물어볼 수 있어요',
        });
        expect(list.querySelectorAll('li')).toHaveLength(2);
        fireEvent.click(screen.getByRole('button', { name: /NVDA 뉴스 요약/ }));
        expect(onPick).toHaveBeenCalledWith('NVDA 뉴스 요약');
    });

    it('falls back to the six static suggestions when none are provided', () => {
        wrap(
            <EmptyState
                onPick={vi.fn()}
                signedIn
                loginHref="/login"
                suggestions={null}
            />
        );
        expect(screen.getAllByRole('button')).toHaveLength(6);
        expect(
            screen.getByRole('button', { name: /내 보유 종목 지금 어때/ })
        ).toBeInTheDocument();
    });

    it('signed out: a login CTA instead of suggestions', () => {
        wrap(
            <EmptyState
                onPick={vi.fn()}
                signedIn={false}
                loginHref="https://siglens.io/login?next=x"
            />
        );
        expect(screen.queryByRole('list')).toBeNull();
        expect(
            screen.getByRole('link', { name: /siglens 계정으로 로그인/ })
        ).toHaveAttribute('href', 'https://siglens.io/login?next=x');
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
            'SiglensAI에게 물어보세요'
        );
    });
});
